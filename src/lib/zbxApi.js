const axios = require('axios').default;

const { UV_FS_O_FILEMAP } = require('constants');
// const { setMaxListeners } = require('../app');
module.exports = class ZabbixApi {
    constructor(url,usr,apitoken,debug) {
        this.url = url+'/api_jsonrpc.php';
        this.usr = usr;
        this.apitoken = apitoken || null;
        this.debug = debug || false;
        this.token = null;
        this.lastaccessdate = null;
        this.accesscontrolmaxage = null;
        const request = require('request');
        this.status=0;

    }
    
    hosts(params,cb){
        this.getinfo("host.get",params,cb)
    }

    problems(params,cb){
        this.getinfo("problem.get",params,cb)
    }

    getinfo(method,params,cb){
        var self=this
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
            cb(response.data)
        })
    }   

    connect(cb) {
        var self=this
        if (!self.apitoken) {
            console.log('No API token configured')
            return cb({data: {error: {code: -1, message: 'No API token configured'}}})
        }
        var reqData = {
            jsonrpc: "2.0",
            method: "user.login",
            params: {"token": self.apitoken},
            id: 1
        }
        if (self.debug) console.log('-->', 'user.login', JSON.stringify(reqData))
        axios({
            method:'post',
            url: self.url,
            headers: {'content-type': 'application/json'},
            responseType: 'json',
            data: reqData
        }).then(function( response){
           if (self.debug) console.log('<--', 'user.login', JSON.stringify(response.data))
           if (response.data.error) {
               console.log('Login failed:', JSON.stringify(response.data.error))
               self.status = 0
               return cb(response)
           }
           self.token = response.data.result
           self.lastaccessdate=response.headers['date']
           self.accesscontrolmaxage= response.headers['access-control-max-age']
           self.status = 1
           cb(response)
        })
    }
    status(){
        return this.status
    }
    items(params,cb){
        this.getinfo("item.get",params,cb)
    }

    dump() {
        return(JSON.stringify(this))
    }
}
