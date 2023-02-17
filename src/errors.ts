export class SpotifyApiError extends Error {
  name: string = 'SpotifyApiError'
  message: string
  statusCode?: number
  constructor(args: { statusCode?: number; message?: string }) {
    super(args.message || 'There was an error with the Spotify API')
    this.message = args.message || 'There was an error with the Spotify API'
    this.statusCode = args.statusCode
  }
}

export class SpotifyTryAgainLater extends Error {
  name: string = 'SpotifyTryAgainLater'
  message: string = 'Try again later'
  retries: number
  data: any
  retryAfter?: number

  constructor(args: { message?: string; retries: number; statusCode: number; retryAfter?: number; data?: any }) {
    super(`API is unavailable after ${args.retries} retries`)
    this.retryAfter = args.retryAfter
    this.retries = args.retries

    if (args.data) {
      this.data = args.data
    }

    if (args.retryAfter) {
      this.retryAfter = args.retryAfter
    }
  }
}

export class SpotifyApiInputError extends Error {
  name: string = 'SpotifyApiInputError'
  constructor(args: { message: string }) {
    super(args.message)
  }
}
