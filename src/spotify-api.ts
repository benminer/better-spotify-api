import { exponentialBackoffWithJitter, sleep } from './util'
import { RequestEngine, Response } from './engine'
import { SpotifyApiError, SpotifyTryAgainLater } from './errors'
import { Playlist, User } from './models'

export type Credentials = {
  clientId: string
  secret: string
}

export type RetrySettings = {
  maxRetries: number
  defaultRetryDelay: number
  maxRetryDelay: number
}

export class SpotifyApi {
  credentialsGetter?: () => Promise<Credentials>

  authToken?: string
  token?: string
  expiresAt?: number

  timeout?: number
  retry?: RetrySettings

  engine: RequestEngine

  constructor(args: {
    credentials: Credentials | (() => Promise<Credentials>)
    retry?: RetrySettings
    timeout?: number
  }) {
    if (typeof args.credentials === 'function') {
      this.credentialsGetter = args.credentials
    } else {
      const credentials = args.credentials as Credentials
      this.setCredentials(credentials)
    }

    this.timeout = args.timeout
    this.retry = args.retry

    this.engine = new RequestEngine({
      timeout: this.timeout
    })
  }

  static parseIdFromUri(uri: string) {
    if (!uri) {
      return undefined
    }

    if (uri.startsWith('https://open.spotify.com/')) {
      const parts = uri.split('/')
      return parts[parts.length - 1]
    }

    return uri
  }

  static buildAuthToken(clientId: string, secret: string) {
    return Buffer.from(`${clientId}:${secret}`).toString('base64')
  }

  static async create(args: {
    credentials: Credentials | (() => Promise<Credentials>)
    retry?: RetrySettings
    timeout?: number
  }) {
    const defaultConfig = {
      retry: {
        maxRetries: 5,
        defaultRetryDelay: 1000,
        maxRetryDelay: 10000
      },
      timeout: 10000
    }

    const config = {
      ...defaultConfig,
      ...args
    }

    return await new SpotifyApi(config).init()
  }

  setCredentials(args: Credentials) {
    const { clientId, secret } = args

    if (!clientId) {
      throw new SpotifyApiError({ message: 'clientId is required' })
    }

    if (!secret) {
      throw new SpotifyApiError({ message: 'secret is required' })
    }

    this.authToken = SpotifyApi.buildAuthToken(clientId, secret)
  }

  async loadCredentials() {
    if (this.credentialsGetter) {
      this.setCredentials(await this.credentialsGetter())
    }
  }

  async request<T>(
    options: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; route: string; body?: Record<string, any> },
    retries = 0,
    maxRetries = this.retry?.maxRetries || 0
  ): Promise<T | undefined> {
    const { method, route, body } = options

    if (!this.token || (this.expiresAt && Date.now() > this.expiresAt)) {
      await this.init()
    }

    const headers = { Authorization: `Bearer ${this.token}` }

    try {
      const response = await this.engine.request({
        method,
        url: route,
        body,
        headers
      })

      if (response.status === 200) {
        return response.body as T
      } else {
        throw new SpotifyApiError({ message: 'Failed to request', statusCode: response.status })
      }
    } catch (err: any | Response) {
      if (err.status) {
        switch (err.status) {
          case 401: {
            await this.init()
            return this.request(options, retries, maxRetries)
          }
          case 502: {
            await this.init()
            return this.request(options, retries, maxRetries)
          }
          case 404: {
            return undefined
          }
          case 429: {
            const retryAfter = err.headers?.['retry-after']
            const waitTimeMs = retryAfter
              ? parseInt(retryAfter) + 1000
              : exponentialBackoffWithJitter({
                  retryCount: retries,
                  retryDelay: this.retry?.defaultRetryDelay || 8000,
                  maxRetryDelay: this.retry?.maxRetryDelay || 30000
                })
            await sleep(waitTimeMs)
            if (retries < maxRetries) {
              return this.request(options, retries + 1, maxRetries)
            }
            throw new SpotifyTryAgainLater({ statusCode: err.status, retries, retryAfter: waitTimeMs, data: err.error })
          }
          default: {
            throw new SpotifyApiError({ statusCode: err.status, message: err.error })
          }
        }
      }
    }
  }

  async init(): Promise<SpotifyApi> {
    if (!this.authToken && this.credentialsGetter) {
      await this.loadCredentials()
    }

    const authUrl = 'https://accounts.spotify.com/api/token'
    const params = {
      grant_type: 'client_credentials'
    }
    const headers = {
      Authorization: `Basic ${this.authToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    try {
      const response = await this.engine.request({
        method: 'POST',
        url: authUrl,
        params,
        headers
      })

      if (response.status === 200) {
        this.engine.baseUrl = 'https://api.spotify.com/v1'
        this.token = response.body.accessToken
        this.expiresAt = Date.now() + response.body.expiresIn * 1000
        return this
      } else {
        throw new SpotifyApiError({ message: 'Failed to authorize', statusCode: response.status })
      }
    } catch (err: any) {
      console.error(err, 'init error')
      throw err
    }
  }

  async playlist(playlistUri: string): Promise<Playlist | undefined> {
    const playlistId = SpotifyApi.parseIdFromUri(playlistUri)
    const response = await this.request<Playlist>({ method: 'GET', route: `/playlists/${playlistId}` })
    if (response) {
      return new Playlist(response, this)
    }
  }

  async user(userUri: string): Promise<User | undefined> {
    const userId = SpotifyApi.parseIdFromUri(userUri)
    const user = await this.request<User>({ method: 'GET', route: `/users/${userId}` })
    if (user) {
      return new User(user, this)
    }
  }
}
