const commonModal = require('client/components/modal_common/index');
const config = require('./config.json');
const request = require('../../request');
const __ = require('locale/client/approval.lang.json');

function pop(obj, parent, callback) {

  config.fields[1].text = obj.rawItem.name;
  config.fields[2].text = obj.childItem.addr;

  let props = {
    __: __,
    parent: parent,
    config: config,
    onInitialize: function(refs) {},
    onConfirm: function(refs, cb) {
      request.detachNetwork(obj).then(() => {
        callback && callback();
        cb(true);
      });
    },
    onAction: function(field, state, refs) {},
    onLinkClick: function() {}
  };

  commonModal(props);
}

module.exports = pop;
