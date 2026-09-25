'use strict';

var getConfig = require('@tridnguyen/config');

var opts = Object.assign({}, getConfig({
    baseUrl: 'https://' + global.baseUrl + '/on/demandware.store/Sites-RefArch-Site/en_US',
    suite: '*',
    reporter: 'spec',
    timeout: 60000,
    locale: 'x_default',
    // OCAPI settings
    ocapi: {
        hostname: global.baseUrl,
        siteId: 'RefArch',
        clientId: process.env.OCAPI_CLIENT_ID || '',
        clientSecret: process.env.OCAPI_CLIENT_SECRET || '',
        bmUser: process.env.BM_USER || '',
        bmPassword: process.env.BM_PASSWORD || ''
    }
}, './config.json'));

module.exports = opts;
