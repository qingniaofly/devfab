import BaseModel from './BaseModel'

export default class SimpleModel extends BaseModel {
    constructor(args) {
        super(args)
    }

    getDisabled() {
        return this.getState('disabled')
    }

    setDisabled(v) {
        return this.setState('disabled', !!v)
    }

    getReadonly() {
        return this.getState('readonly')
    }

    setReadonly(v) {
        this.setState('readonly', !!v)
    }
}
