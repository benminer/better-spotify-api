# Better Spotify API

A class based library for easily interacting with the Spotify Web API.

## Why

There is really only one other NodeJS Spotify API wrapper, and I found it hard to use and a bit buggy for my needs. I feel most people utilizing the Spotify API are doing a lot of relational calls (eg: get a playlist, get a track on playlist, get artist info). This could be done better using abstractions for each type of data entity.

## Goals

- Absolutely zero dependencies, this project is meant to simple and small. There should be no need for build dependencies.

## Roadmap

- Implement all non 'user' centered API routes from [here](https://developer.spotify.com/documentation/web-api/reference/#/)
- 1:1 class models for all Spotify Entities: Playlist, Track, User, Audiobooks, Episodes, Shows, Albums, Artists
- Smart Search, parse args cleanly. User should not have to think about doing any formatting.
- For any paginated API requests, there should be both `.page` for AsyncGenerators and `list` that allows to get everything at once.
- :white_check_mark: Auto retries with jitter, auto session refreshes
- Full testability (with Jest): all entities should be class based unless it is a utility. This allows for better DX and easier testing.
- User based authentication for authorized API requests
- 'Player' integration
