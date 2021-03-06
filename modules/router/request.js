const storage = require('client/applications/approval/cores/storage');
const fetch = require('client/applications/approval/cores/fetch');
const RSVP = require('rsvp');

module.exports = {
  getList: function(forced) {
    return storage.getList(['router', 'network', 'subnet'], forced).then(function(data) {
      let exNetworks = [];
      data.network.forEach((item) => {
        if (item['router:external']) {
          exNetworks.push(item);
          return true;
        }
        return false;
      });

      if(exNetworks.length > 1) {
        data.router.forEach(r => {
          if(r.external_gateway_info) {
            exNetworks.some(n => {
              if(r.external_gateway_info.network_id === n.id) {
                r.external_gateway_info.network_name = n.name;
                return true;
              }
              return false;
            });
          }
        });
      }

      return data.router;
    });
  },
  getPrices: function() {
    return fetch.get({
      url: '/proxy/gringotts/v2/products'
    });
  },
  editRouterName: function(item, newName) {
    let data = {};
    data.router = {};
    data.router.name = newName;

    return fetch.put({
      url: '/proxy/neutron/v2.0/routers/' + item.id,
      data: data
    });
  },
  deleteRouters: function(items) {
    let deferredList = [];
    items.forEach((item) => {
      deferredList.push(fetch.delete({
        url: '/proxy/neutron/v2.0/routers/' + item.id
      }));
    });
    return RSVP.all(deferredList);
  },
  createRouter: function(data) {
    return fetch.post({
      url: '/api/apply',
      data: data
    });
  },
  updateRouter: function(routerId, data) {
    return fetch.put({
      url: '/proxy/neutron/v2.0/routers/' + routerId,
      data: {
        router: data
      }
    });
  },
  addInterface: function(routerId, data) {
    return fetch.put({
      url: '/proxy/neutron/v2.0/routers/' + routerId + '/add_router_interface',
      data: data
    });
  },
  changeFip: function(routerId, fipId) {
    return fetch.put({
      url: '/proxy/neutron/v2.0/floatingips/' + fipId,
      data: {
        floatingip: {
          port_id: routerId
        }
      }
    });
  },
  getGateway: function() {
    return storage.getList(['network']).then(function(data) {
      let exNetworks = [];
      data.network.forEach((item) => {
        if (item['router:external']) {
          exNetworks.push(item);
          return true;
        }
        return false;
      });
      return exNetworks;
    });
  },
  getSubnets: function(forced) {
    return storage.getList(['subnet'], forced).then(function(data) {
      return data.subnet;
    });
  },
  detachSubnet: function(item) {
    let data = {};
    data.subnet_id = item.childItem.id;

    return fetch.put({
      url: '/proxy/neutron/v2.0/routers/' + item.rawItem.id + '/remove_router_interface',
      data: data
    });
  }
};
