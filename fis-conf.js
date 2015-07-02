fis.config.merge({
    modules: {
        lint: {
            js: 'jshint'
        }
    },
    settings: {
        lint: {
            jshint: {
                asi: true,
                passfail: true,
                strict: true
            }
        }
    }  
})