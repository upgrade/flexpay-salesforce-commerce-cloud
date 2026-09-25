'use strict';

(function () {
    module.exports = {
        config: require('./flexpayConfig'),
        api: require('./flexpayAPI').api,
        constants: require('./flexpayConstants')
    };
}());
