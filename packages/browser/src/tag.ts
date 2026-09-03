// Entry of the built `mixdive.js` tag (see tag-install.ts).
import { installTag } from './tag-install'

installTag(window, document.currentScript as HTMLScriptElement | null)
