require('./style/index.less');

var React = require('react');
var Main = require('client/components/main/index');

var BasicProps = require('client/components/basic_props/index');
var deleteModal = require('client/components/modal_delete/index');
var ApplyDetail = require('../../components/apply_detail/index');

var acceptApply = require('./pop/accept/index');
var refuseApply = require('./pop/refuse/index');

var config = require('./config.json');
var request = require('./request');
var router = require('client/utils/router');
var __ = require('locale/client/approval.lang.json');
var getStatusIcon = require('../../utils/status_icon');

class Model extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      config: config
    };

    ['onInitialize', 'onAction'].forEach((m) => {
      this[m] = this[m].bind(this);
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.props.style.display === 'none' && !nextState.config.table.loading) {
      return false;
    }
    return true;
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.style.display !== 'none' && this.props.style.display === 'none') {
      if (this.state.config.table.loading) {
        this.loadingTable();
      } else {
        this.getTableData(false);
      }
    }
  }

  onInitialize(params) {
    this.getTableData(false);
  }

  getTableData(forceUpdate, detailRefresh) {
    request.getList(forceUpdate).then((res) => {
      var table = this.state.config.table;
      table.data = res;
      table.loading = false;

      var detail = this.refs.dashboard.refs.detail;
      if (detail && detail.state.loading) {
        detail.setState({
          loading: false
        });
      }

      this.setState({
        config: config
      }, () => {
        if (detail && detailRefresh) {
          detail.refresh();
        }
      });
    });
  }

  onAction(field, actionType, refs, data) {
    switch (field) {
      case 'btnList':
        this.onClickBtnList(data.key, refs, data);
        break;
      case 'table':
        this.onClickTable(actionType, refs, data);
        break;
      case 'detail':
        request.getResourceInfo().then(res => {
          this.onClickDetailTabs(actionType, refs, data, res);
        });
        break;
      default:
        break;
    }
  }

  onClickBtnList(key, refs, data) {
    var rows = data.rows;
    var that = this;
    switch (key) {
      case 'accept':
        acceptApply(rows[0], null, () => {
          this.refresh({
            tableLoading: true,
            clearState: true,
            detailRefresh: true
          }, true);
        });
        break;
      case 'refuse':
        refuseApply(rows[0], null, () => {
          this.refresh({
            tableLoading: true,
            clearState: true,
            detailRefresh: true
          }, true);
        });
        break;
      case 'delete':
        deleteModal({
          __: __,
          action: 'delete',
          type: 'keypair',
          data: rows,
          onDelete: function(_data, cb) {
            request.deleteKeypairs(rows).then((res) => {
              cb(true);
              that.refresh(null, true);
            });
          }
        });
        break;
      case 'refresh':
        this.refresh({
          tableLoading: true,
          clearState: true
        }, true);
        break;
      default:
        break;
    }
  }

  onClickTable(actionType, refs, data) {
    switch (actionType) {
      case 'check':
        this.onClickTableCheckbox(refs, data);
        break;
      default:
        break;
    }
  }

  onClickTableCheckbox(refs, data) {
    var {rows} = data,
      btnList = refs.btnList,
      btns = btnList.state.btns;

    btnList.setState({
      btns: this.btnListRender(rows, btns)
    });
  }

  btnListRender(rows, btns) {
    for(let key in btns) {
      switch (key) {
        case 'accept':
        case 'refuse':
          btns[key].disabled = rows.length === 1 ? false : true;
          break;
        default:
          break;
      }
    }

    return btns;
  }

  onClickDetailTabs(tabKey, refs, data, resourceData) {
    var {rows} = data;
    var detail = refs.detail;
    var contents = detail.state.contents;
    // var syncUpdate = true;

    var isAvailableView = (_rows) => {
      if (_rows.length > 1) {
        contents[tabKey] = (
          <div className="no-data-desc">
            <p>{__.view_is_unavailable}</p>
          </div>
        );
        return false;
      } else {
        return true;
      }
    };

    switch(tabKey) {
      case 'description':
        if(isAvailableView(rows)) {
          var basicPropsItem = this.getBasicPropsItems(rows[0]);
          contents[tabKey] = (
            <div>
              <BasicProps
                title={__.basic + __.properties}
                defaultUnfold={true}
                tabKey={'description'}
                rawItem={rows[0]}
                items={basicPropsItem ? basicPropsItem : []} />
              <ApplyDetail
                title={__.application + __.detail}
                defaultUnfold={true}
                items={rows[0].detail}
                data={resourceData} />
            </div>
          );
        }
        break;
      default:
        break;
    }

    detail.setState({
      contents: contents
    });
  }

  getBasicPropsItems(item) {
    var items = [{
      title: __.id,
      content: item.id
    }, {
      title: __.apply_desc,
      content: item.description ? item.description : '-'
    }, {
      title: __.status,
      content: getStatusIcon(item.status)
    }, {
      title: __.applicant,
      content: item.username
    }, {
      title: __.project + __.id,
      content: item.projectId
    }, {
      title: __.create + __.time,
      content: item.createdAt,
      type: 'time'
    }];

    return items;
  }

  refresh(data, forceUpdate) {
    if (data) {
      var path = router.getPathList();
      if (path[2]) {
        if (data.detailLoading) {
          this.refs.dashboard.refs.detail.loading();
        }
      } else {
        if (data.tableLoading) {
          this.loadingTable();
        }
        if (data.clearState) {
          this.refs.dashboard.clearState();
        }
      }
    }

    this.getTableData(forceUpdate, data ? data.detailRefresh : false);
  }

  loadingTable() {
    var _config = this.state.config;
    _config.table.loading = true;

    this.setState({
      config: _config
    });
  }

  render() {
    return (
      <div className="halo-module-apply-approval" style={this.props.style}>
        <Main
          ref="dashboard"
          visible={this.props.style.display === 'none' ? false : true}
          onInitialize={this.onInitialize}
          onAction={this.onAction}
          config={this.state.config}
          params={this.props.params}
          getStatusIcon={getStatusIcon}
          __={__} />
      </div>
    );
  }

}

module.exports = Model;