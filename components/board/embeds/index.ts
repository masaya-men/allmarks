export { EmbedPosterBox, EmbedPlayButton } from './EmbedShell'
export { YouTubeEmbed } from './YouTubeEmbed'
export { VimeoEmbed } from './VimeoEmbed'
export { SoundCloudEmbed } from './SoundCloudEmbed'
export { TikTokEmbed } from './TikTokEmbed'
export { InstagramEmbed } from './InstagramEmbed'
export { TweetVideoEmbed, resolveTweetVideoSource } from './TweetVideoEmbed'
export type { TweetVideoItem, TweetVideoSource, MediaVariant } from './TweetVideoEmbed'
// Task 3 switches the board over to the registry's item-based canPlayInline;
// until then the barrel still re-exports the url-based one from InlineMediaPlayer.
export { resolveInlinePlayer, resolveLightboxPlayer, canViewportAutoplay } from './media-players'
export type { PlayableItem } from './media-players'
export { InlineMediaPlayer, canPlayInline } from './InlineMediaPlayer'
