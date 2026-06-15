const { profileEnd } = require('console');
var express = require('express');
var router = express.Router();
const fs = require('fs');


const gethosts = (zbxcli,param) => { 
    return new Promise((resolve, reject) => {
      zbxcli.hosts(param,(data) => {
          resolve(data.result)
        })
    })
  }

const getproblems = (zbxcli,param) => { 
    return new Promise((resolve, reject) => {
      zbxcli.problems(param,(data) => {
          resolve(data.result)
        })
     })
  }

function zbx_pb_to_prometheus(zbxcli,params) {
  return new Promise((resolve, reject) => {
    let problemTag = params.problem_tag || ''
    let problemValue = params.problem_value || ''
    delete params.problem_tag
    delete params.problem_value
    let problemParams = {output: "extend"}
    if (problemTag) {
      problemParams.tags = [{tag: problemTag, value: problemValue, operator: 'equals'}]
      problemParams.evaltype = 0
    }
    meta_name="zabbix_problem"
    lines="# HELP "+meta_name+' problem zabbix\n# TYPE '+meta_name+' gauge'+'\n'
    output=lines
    
    getproblems(zbxcli,problemParams)
    .then(function(problems)  {
        let i=0
        for(i=0 ;i < problems.length;i++){
          output+=meta_name+'{name="'+problems[i].name+'",objectid="'+problems[i].objectid+'"} '+problems[i].severity+'\n'
          }   
          resolve(output)
      });
    })
  }

  function zbx_items_to_prometheus(zbxcli,params) {
    return new Promise((resolve, reject) => {
      let itemTag = params.item_tag || ''
      let itemValue = params.item_value || ''
      delete params.item_tag
      delete params.item_value
      meta_name1="zabbix_item"
      lines1="# HELP "+meta_name1+' item zabbix\n# TYPE '+meta_name1+' gauge'+'\n'
      output1=lines1
      gethosts(zbxcli,params)
      .then((hosts) => {
        (async function loop() {
          for( let i=0 ;i < hosts.length;i++){
            let itemParams = {hostids: hosts[i].hostid}
            if (itemTag) {
              itemParams.tags = [{tag: itemTag, value: itemValue, operator: 'equals'}]
              itemParams.evaltype = 0
            }
            await getitems(zbxcli,itemParams).then(items => {
              items.forEach(function(item){ 
                if( item.value_type == 0 || item.value_type==3){             
                  output1+=(meta_name1+'{name="'+item.name+'",host="'+hosts[i].name+'",value_type="'+item.value_type+'"} '+item.lastvalue+'\n')
                }
              })
            })
            if(i=== hosts.length-1){
              resolve(output1)
            }
          }
        })();
    })
  })
}
  
const getitems = (zbxcli,param) => { 
  return new Promise((resolve, reject) => {
    zbxcli.items(param,(data) => {
        resolve(data.result) 
      })
  })
}




/* GET home page. */
router.get('/zbx/hosts', function(req, res, next) {
  res.locals.zbxcon.hosts({"output":["name","hostid"]}, function(data){
    res.json(data.result)
  })
})

router.get('/zbx/problems', function(req, res, next) {
  res.locals.zbxcon.problems({"output":"extend"}, function(data){
    res.json(data)
  })
})

router.get('/status', function(req, res, next) {
    res.json({status:res.locals.applis.status ,zbxcon:res.locals.zbxcon.status })
  });

router.get('/config', function(req, res, next) {
    res.json(res.locals.config)
})
router.get('/setting', function(req, res, next) {
    res.json(res.locals.applis)
})
router.post('/config', function(req, res, next) {
    exporter=res.locals.config.exporter
    res.locals.config.zbx=req.body
    res.locals.config.exporter= exporter
    let data = JSON.stringify(res.locals.config,null,2);
    fs.writeFileSync(res.locals.applis.RootPath+'/config.json', data);
    res.json({"status":"ok","message":"Config updated"})
})
  

router.post('/config/hosts', function(req, res, next) {
    res.locals.config.exporter.hostlist=req.body
    let data = JSON.stringify(res.locals.config,null,2);
    fs.writeFileSync(res.locals.applis.RootPath+'/config.json', data);
    res.json({"status":"ok","message":"Config updated"})
})
  



router.get('/metrics/prometheus', function(req, res, next) {
  let params = {"filter": {"name": res.locals.config.exporter.hostlist},"output":["name","hostid"]}
  if (res.locals.config.zbx.filter && res.locals.config.zbx.filter.tag) {
    params.item_tag = res.locals.config.zbx.filter.tag
    params.item_value = res.locals.config.zbx.filter.value || ''
  }
  let pbParams = {}
  if (res.locals.config.zbx.filter && res.locals.config.zbx.filter.tag) {
    pbParams.problem_tag = res.locals.config.zbx.filter.tag
    pbParams.problem_value = res.locals.config.zbx.filter.value || ''
  }
  const result =  Promise.all([zbx_pb_to_prometheus(res.locals.zbxcon, pbParams), zbx_items_to_prometheus(res.locals.zbxcon, params)]).then(values => {

    res.set('Content-Type', 'text/plain');
    for(i=0 ;i < values.length;i++){
      res.write(values[i])
    }
    res.end()
  });
})

module.exports = router;
