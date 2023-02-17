import fs from 'fs'
import Module from 'module'
import { dirname, extname, join, resolve as pathResolve } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import JoyCon from 'joycon'
import { addHook } from 'pirates'
import sourceMapSupport from 'source-map-support'
import tsconfigLoader from 'tsconfig-paths/lib/tsconfig-loader'
import { createMatchPath } from 'tsconfig-paths'

const ESBUILD_PATH = process.env.ESBUILD_PATH || '/opt/nodejs/node_modules/esbuild'
const { default: esbuild } = await import(ESBUILD_PATH)
const { transform, transformSync } = esbuild

const baseURL = pathToFileURL(`${process.cwd()}/`).href

/*
TODO: consider caching loaded files in to memory if asked, so that we can cache them to negate the need to nft/esbuild?
at least cache transforms?
*/

const joyCon = new JoyCon()
const matcherCache = {}

function matchPath(specifier, parentPath) {
  const base = dirname(parentPath || process.cwd())

  const configs = [joyCon.resolveSync(['tsconfig.json'], base), joyCon.resolveSync(['jsconfig.json'], base)]

  for (const configPath of configs) {
    if (configPath) {
      let matcher = matcherCache[configPath]
      if (!matcher) {
        const loaded = tsconfigLoader.loadTsconfig(configPath)
        if (loaded) {
          const { baseUrl, paths } = loaded.compilerOptions

          if (paths) {
            const absoluteBaseUrl = pathResolve(dirname(configPath), baseUrl)
            matcher = createMatchPath(absoluteBaseUrl, paths)
            matcherCache[configPath] = matcher
          }
        }
      }

      if (matcher) {
        const matched = matcher(specifier)
        if (matched) {
          if (extensions.has(extname(matched))) {
            return matched
          }

          for (const ext of ['.ts', '.mts', '.cts', '/index.ts', '/index.mts', '/index.cts']) {
            const tsPath = `${matched}${ext}`

            if (fs.existsSync(tsPath)) {
              return tsPath
            }
          }

          return matched
        }
      }
    }
  }

  if (isBareImport(specifier)) {
    for (const ext of ['.ts', '.mts', '.cts', '/index.ts', '/index.mts', '/index.cts']) {
      const tsPath = join(base, `${specifier}${ext}`)
      // console.log('check', tsPath)
      if (fs.existsSync(tsPath)) {
        return tsPath
      }
    }
  }
}

const sourceMaps = {}

sourceMapSupport.install({
  handleUncaughtExceptions: false,
  environment: 'node',
  retrieveSourceMap(file) {
    if (sourceMaps[file]) {
      return {
        url: file,
        map: sourceMaps[file]
      }
    } else {
      const name = `${file}.map`
      if (fs.existsSync(name)) {
        const map = JSON.parse(fs.readFileSync(name).toString('utf8'))
        sourceMaps[file] = map
        return {
          url: file,
          map
        }
      }
    }
    return null
  }
})

function isModulePackage(base) {
  const { data = {} } = joyCon.loadSync(['package.json'], base)
  return data.type === 'module'
}

const extensions = new Set(['.js', '.mjs', '.cjs', '.json', '.node', '.ts', '.mts', '.cts'])

function isBareImport(specifier) {
  return (
    (specifier.startsWith('./') ||
      specifier.startsWith('..') ||
      specifier.startsWith('/') ||
      specifier.startsWith('file:///') ||
      specifier.startsWith('file://.')) &&
    !extensions.has(extname(specifier))
  )
}

export function resolve(specifier, context, defaultResolve) {
  if (!specifier.startsWith('file://') && !specifier.startsWith('node:')) {
    const { parentURL = baseURL } = context
    const matched = matchPath(specifier, fileURLToPath(parentURL))

    if (matched) {
      return { shortCircuit: true, url: pathToFileURL(matched).href }
    }
  }

  return defaultResolve(specifier, context)
}

export async function load(sourcefile, context, defaultLoad) {
  const result = await defaultLoad(sourcefile, context)

  if (sourcefile.startsWith('file://')) {
    const path = fileURLToPath(sourcefile)
    const ext = extname(path)

    const isTs = ext === '.ts'
    const isMts = ext === '.mts'
    const isCts = ext === '.cts'

    if (isTs || isMts || isCts) {
      const isESM =
        context.format === 'module' || result.format === 'module' || isMts || (isTs && isModulePackage(path))

      const { code, warnings, map } = await transform(result.source.toString(), {
        sourcefile,
        format: isESM ? 'esm' : 'cjs',
        sourcemap: true,
        sourcesContent: false,
        loader: 'ts',
        target: `node${process.version.slice(1)}`
      })

      sourceMaps[sourcefile] = map

      if (warnings && warnings.length > 0) {
        for (const warning of warnings) {
          console.log(warning.location)
          console.log(warning.text)
        }
      }

      result.shortCircuit = true
      result.source = code
      result.format = isESM ? 'module' : 'commonjs'
    }
  }

  return result
}

function compile(source, sourcefile) {
  const {
    code,
    warnings = [],
    map
  } = transformSync(source, {
    sourcefile,
    format: 'cjs',
    loader: 'ts',
    sourcemap: true,
    sourcesContent: false
  })

  sourceMaps[sourcefile] = map

  for (const warning of warnings) {
    console.warn(warning)
  }

  return code
}

addHook(compile, {
  exts: ['.ts', '.cts'],
  ignoreNodeModules: false
})

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent) {
  // console.log('resolve filenae', request, parent)
  // todo: why is parent undfefined sometimes, and what can we pass to matchPath?
  const matchedPath = parent ? matchPath(request, parent.path) : null
  return originalResolveFilename.call(this, matchedPath || request, parent)
}
