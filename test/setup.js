import { plugin } from 'bun'
import vuePlugin from './vue-plugin.js'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Register Vue SFC plugin
plugin(vuePlugin())

// Register DOM globals
GlobalRegistrator.register()
