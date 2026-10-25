/** The parts of Jellyfin's BaseItemDto the app reads. */
export interface ItemDto {
    Id: string
    Name?: string
    Type?: string
    ProductionYear?: number
    RunTimeTicks?: number
    Overview?: string
    Genres?: string[]
    OfficialRating?: string
    CommunityRating?: number
    DateCreated?: string
    DateLastMediaAdded?: string
    ChildCount?: number
    Width?: number
    UserData?: {
        PlaybackPositionTicks?: number
        Played?: boolean
        LastPlayedDate?: string
        PlayedPercentage?: number
    }
    ImageTags?: Record<string, string>
    BackdropImageTags?: string[]
    ImageBlurHashes?: Record<string, Record<string, string>>
    MediaStreams?: StreamDto[]
    SeriesId?: string
    SeriesName?: string
    SeasonId?: string
    ParentIndexNumber?: number
    IndexNumber?: number
    ParentThumbItemId?: string
    ParentThumbImageTag?: string
    ParentBackdropItemId?: string
    ParentBackdropImageTags?: string[]
    ParentLogoItemId?: string
    ParentLogoImageTag?: string
}

export interface StreamDto {
    Type?: string
    Codec?: string
    Width?: number
    VideoRangeType?: string
    AudioSpatialFormat?: string
}

export interface ItemsResponse {
    Items: ItemDto[]
}

export interface SegmentDto {
    Type?: string
    StartTicks?: number
    EndTicks?: number
}
