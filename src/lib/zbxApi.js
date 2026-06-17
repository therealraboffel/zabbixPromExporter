const axios = require('axios').default;

module.exports = class ZabbixApi {
    constructor(url,apitoken,debug,cachetime) {
        this.url = url+'/api_jsonrpc.php';
        this.token = apitoken || null;
        this.debug = debug || false;
        this.cache_time = cachetime || 0;
        this.cache = {};
        this.status = this.token ? 1 : 0;
    }
    
    hosts(params,cb){
        this.getinfo("host.get",params,cb)
    }

    problems(params,cb){
        this.getinfo("problem.get",params,cb)
    }

    getinfo(method,params,cb){
        var self=this
        var cacheKey = method + JSON.stringify(params)

        if (self.cache_time > 0 && self.cache[cacheKey]) {
            var entry = self.cache[cacheKey]
            if (Date.now() - entry.timestamp < self.cache_time * 1000) {
                if (self.debug) console.log('CACHE', method, 'serving from cache')
                cb(entry.data)
                return
            }
        }

        var reqData = {
            jsonrpc: "2.0",
            method: method,
            params: params,
            id: 1,
            auth: self.token
        }
        if (self.debug) console.log('-->', method, JSON.stringify(reqData))
        axios({
            method:'post',
            url: self.url,
            headers: {"content-type": "application/json"},
            responseType: 'json',
            data: reqData
        }).then(function( response){
            if (self.debug) console.log('<--', method, JSON.stringify(response.data))
            if (self.cache_time > 0) {
                self.cache[cacheKey] = {data: response.data, timestamp: Date.now()}
            }
            cb(response.data)
        })
    }   

    status(){
        return this.status
    }
    items(params,cb){
        this.getinfo("item.get",params,cb)
    }
}
