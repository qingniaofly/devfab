import Builder from './_utils/builder'
import models from './_models'
import utils from './_utils'

const devfab = {
    utils: {
        builder: new utils.Builder(),
        cache: new utils.CacheUtil(),
        event: new utils.EventUtil(),
    },
    common: {
        Builder,
        models,
        utils,
    },
}

export default devfab
