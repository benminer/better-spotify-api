#!/usr/bin/env node
const { fork } = require('child_process')
const { join, parse } = require('path')
const { existsSync, readdirSync, statSync } = require('fs')
const yargs = require('yargs')

require('dotenv').config()

const { logLevel = process.env.LOG_LEVEL || 'error' } = yargs(process.argv)
  .options({
    stage: { type: 'string', alias: 's', default: 'dev' },
    profile: { type: 'string', default: 'streaming-promotions' }
  })
  .help(false).argv

function findScript(cmd) {
  const { name } = parse(cmd)
  const rootScriptDir = join('scripts')
  const scriptDirs = readdirSync(rootScriptDir).filter((file) => statSync(join(rootScriptDir, file)).isDirectory())
  console.log(scriptDirs)
  for (const ext of ['ts', 'mjs', 'js', 'cjs']) {
    const script = join(rootScriptDir, `${name}.${ext}`)
    if (existsSync(script)) {
      return script
    } else {
      for (const dir of scriptDirs) {
        const script = join(rootScriptDir, dir, `${name}.${ext}`)
        if (existsSync(script)) {
          return script
        }
      }
    }
  }
}

async function getEntrypoint(cmd) {
  const script = findScript(cmd)

  if (script) {
    process.argv.shift()
    return script
  }

  throw new Error(`No command or script named ${cmd}`)
}

const main = async () => {
  process.argv.shift()
  process.argv.shift()

  const cmd = process.argv[0]
  const entrypoint = await getEntrypoint(cmd)
  const args = process.argv

  const result = fork(entrypoint, args, {
    env: {
      ...process.env,
      LOG_LEVEL: logLevel,
      ESBUILD_PATH: 'esbuild',
      LAMBDA_TASK_ROOT: process.cwd()
    },
    execArgv: ['--no-warnings', '--experimental-specifier-resolution=node', '--loader', join(__dirname, 'loader.mjs')]
  })
  result.on('error', console.log)
}

main()
