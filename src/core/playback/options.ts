import { getSettings } from '../data/settings'
import { defaultProfileOptions, type ProfileOptions } from './deviceProfile'

/** The device profile options with the user's Quality and subtitle settings applied. */
export function currentProfileOptions(): ProfileOptions {
    const settings = getSettings()
    return { ...defaultProfileOptions, maxBitrate: settings.maxBitrate, burnInAss: settings.burnInAss }
}
