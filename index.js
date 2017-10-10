let _          = require('lodash');
let router     = require('express').Router();
let {ObjectId} = require('mongodb');

module.exports = configs => {
  let {conn, io, dataBus, usersCollectionName} = configs;
  let baseName = 'roles';
  let baseRoute = `/${baseName}`;
  
  io = io.of(baseRoute);

  dataBus.on(`${usersCollectionName}.post`, async record => {
    let {roleId} = record;
    let criteria = {roleId: ObjectId(roleId)};
    let count = await conn.db.collection(usersCollectionName).count(criteria);
    
    if(count === 1) {
      io.emit('patch', {_id: roleId, users: true});  
    }
  });

  dataBus.on(`${usersCollectionName}.delete`, async record => {
    let {roleId} = record;
    let criteria = {roleId: ObjectId(roleId)};
    let count = await conn.db.collection(usersCollectionName).count(criteria);
    
    if(!count) {
      io.emit('patch', {_id: roleId, users: false});
    }
  });

  router.post(baseRoute, async (req, res) => {
    let method = req.method.toLowerCase();
    let record = _.omit(req.body, ['_id']);
    let result = await conn.db.collection(baseName).insert(record);
    [record] = result.ops;
    io.emit(method, record);
    res.send(record);
  });

  router.get(baseRoute, async (req, res) => {
    let {query} = req;
    let {_id} = query;

    if(_id) {
      _.extend(query, {_id: ObjectId(_id)});
    }

    let resultsPromise = conn.db.collection(baseName).find(query).toArray();
    let results = await resultsPromise.catch(err => console.log(err));

    let promises = results.reduce((promises, record) => {
      let {_id} = record;
      let roleId = ObjectId(_id);
      let promise = conn.db.collection(usersCollectionName).count({roleId});
      return promises.concat(promise);
    }, []);

    let userCounts = await Promise.all(promises);

    userCounts.forEach((count, index) => {
      results[index].users = !!count;
    });
    
    res.send(results);
  });

  router.delete(baseRoute, async (req, res) => {
    let method = req.method.toLowerCase();
    let {_id} = req.query;
    let criteria = {_id: ObjectId(_id)};
    let record = await conn.db.collection(baseName).findOne(criteria);
    await conn.db.collection(baseName).remove(criteria);
    io.emit(method, record);
    res.send(record);
  });

  router.patch(baseRoute, async (req, res) => {
    let method = req.method.toLowerCase();
    let {_id} = req.body;
    let criteria = {_id: ObjectId(_id)};
    let update = _.omit(req.body, ['_id']);
    let result = await conn.db.collection(baseName).replaceOne(criteria, update);
    let [record] = result.ops;
    _.extend(record, {_id});
    
    io.emit(method, record);
    res.send(record);
  });

  return router;
};
