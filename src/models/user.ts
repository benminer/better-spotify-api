import { SpotifyApi } from '..'

export class User implements User {
  api: SpotifyApi
  constructor(data: User, api: SpotifyApi) {
    this.api = api

    this.displayName = data.displayName
    this.id = data.id
    this.href = data.href
    this.type = data.type
    this.images = data.images
    this.uri = data.uri
    this.followers = data.followers
    this.externalUrls = data.externalUrls
  }

  async topTracks() {}

  async topArtists() {}
}

export interface User {
  displayName: string
  externalUrls: ExternalUrls
  followers: Followers
  href: string
  id: string
  images: Image[]
  type: string
  uri: string
}

export interface ExternalUrls {
  spotify: string
}

export interface Followers {
  href: null
  total: number
}

export interface Image {
  height: null
  url: string
  width: null
}
