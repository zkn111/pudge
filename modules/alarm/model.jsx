require('./style/index.less');

var React = require('react');
var Main = require('client/components/main/model');
var { Button } = require('client/uskin/index');

var BasicProps = require('client/components/basic_props/index');
var DetailMiniTable = require('client/components/detail_minitable/index');
var LineChart = require('client/components/line_chart/index');
var description = require('./detail/description');
var history = require('./detail/history');

var createAlarm = require('./pop/create/index');
var enableAlarm = require('./pop/enable_alarm/index');
var deleteModal = require('client/components/modal_delete/index');
var addNotification = require('./pop/add_notification/index');

var config = require('./config.json');
var __ = require('locale/client/approval.lang.json');
var request = require('./request');
var getStatusIcon = require('../../utils/status_icon');
var getErrorMessage = require('client/applications/approval/utils/error_message');
var utils = require('./utils');
var timeUtils = require('../../utils/utils');

class Model extends Main {

  constructor(props) {
    super(props);

    this.state = {
      config: config
    };

    this.lang = __;
    this.getStatusIcon = getStatusIcon;
  }

  tableColRender() {
    let columns = this.state.config.table.column;

    columns.forEach((column) => {
      switch (column.key) {
        case 'resource':
          column.render = (col, item, i) => {
            return utils.getResourceComponent(item);
          };
          break;
        case 'enabled':
          column.render = (col, item, i) => {
            return item.enabled ?
              <span className="label-active">{__.on}</span>
            : <span className="label-down">{__.off}</span>;
          };
          break;
        default:
          break;
      }
    });

  }

  getList(forceUpdate, detailRefresh) {
    return request.getList(forceUpdate);
  }

  onClickBtnList(key, refs, data) {
    let rows = data.rows;
    switch (key) {
      case 'create':
        createAlarm({
          type: 'create'
        }, null, () => {
          this.refreshForce();
        });
        break;
      case 'enable':
        enableAlarm(rows[0], true, () => {
          this.refreshForce();
        });
        break;
      case 'disable':
        enableAlarm(rows[0], false, () => {
          this.refreshForce();
        });
        break;
      case 'modify':
        createAlarm({
          type: 'alarm',
          item: rows[0]
        }, null, () => {
          this.refreshForce();
        });
        break;
      case 'delete':
        let that = this;
        deleteModal({
          __: __,
          action: 'delete',
          type: 'alarm',
          data: rows,
          iconType: 'monitor',
          onDelete: function(_data, cb) {
            let alarmId = rows[0].alarm_id;
            request.deleteAlarm(alarmId).then((res) => {
              cb(true);
              that.refreshForce();
            }).catch((error) => {
              cb(false, getErrorMessage(error));
            });
          }
        });
        break;
      default:
        break;
    }
  }

  btnListRender(rows, btns) {
    let isSingle = rows.length === 1;

    btns.enable.disabled = !(isSingle && !rows[0].enabled);
    btns.disable.disabled = !(isSingle && rows[0].enabled);
    btns.modify.disabled = !isSingle;
    btns.delete.disabled = !isSingle;

    return btns;
  }

  onClickDetailTabs(tabKey, refs, data) {
    var {rows} = data;
    var detail = refs.detail;
    var contents = detail.state.contents;

    var syncUpdate = true;
    var isSingle = rows.length === 1;
    var unavailableView = (
      <div className="no-data-desc">
        <p>{__.view_is_unavailable}</p>
      </div>
    );
    if (!isSingle) {
      contents[tabKey] = unavailableView;
    }
    var update = (newContents, loading) => {
      detail.setState({
        contents: newContents,
        loading: loading
      });
    };
    const detailLoading = () => {
      contents[tabKey] = (<div />);
      detail.setState({
        contents: contents,
        loading: true
      });
    };

    switch(tabKey) {
      case 'description':
        if (isSingle) {
          syncUpdate = false;

          request.getNofitications().then((notifications) => {

            let item = rows[0];
            let rule = item.gnocchi_resources_threshold_rule;
            const updateContent = (resourceItem) => {
              let basicPropsItem = description.getBasicPropsItems(resourceItem);
              let notificationConfig = description.getNotificationConfig(resourceItem, notifications, this.refreshForce);

              contents[tabKey] = (
                <div>
                  <BasicProps
                    title={__.basic + __.properties}
                    defaultUnfold={true}
                    tabKey={'description'}
                    items={basicPropsItem ? basicPropsItem : []}
                    rawItem={resourceItem}
                    onAction={this.onDetailAction.bind(this)} />
                  <DetailMiniTable
                    __={__}
                    title={__.alarm_notification}
                    defaultUnfold={true}
                    tableConfig={notificationConfig}
                  >
                    <Button value={__.add + __.alarm_notification}
                      onClick={this.onDetailAction.bind(this, 'description', 'add_alarm_notification', {
                        rawItem: resourceItem
                      })} />
                  </DetailMiniTable>
                </div>
              );

              update(contents);
            };

            if (rule.resource_type === 'instance_network_interface' && !rule._port_id) {
              detailLoading();

              request.getOriginalPort(rule.resource_id).then((args) => {
                const ports = args[0];
                const resource = args[1];
                let originalPortId = resource.original_resource_id.slice(-11);

                ports.some((port) => {
                  let portId = port.id.substr(0, 11);

                  if (originalPortId === portId) {
                    rule._port_id = port.id;
                    rule._port_name = port.name;
                    rule._port_exist = true;
                    return true;
                  }
                  return false;
                });

                if (!rule._port_exist) {
                  rule._port_id = originalPortId;
                }

                updateContent(item);
              });
            } else {
              updateContent(item);
            }

          });
        }
        break;
      case 'monitor':
        if (isSingle) {
          syncUpdate = false;
          let that = this;

          let granularity = '';
          if (data.granularity) {
            granularity = data.granularity;
          } else {
            granularity = '300';
            detailLoading();
          }
          let time = data.time;

          let rule = rows[0].gnocchi_resources_threshold_rule;
          let tabItems = [{
            name: __.three_hours,
            key: '300',
            time: 'hour'
          }, {
            name: __.one_day,
            key: '900',
            time: 'day'
          }, {
            name: __.one_week,
            key: '3600',
            time: 'week'
          }, {
            name: __.one_month,
            key: '21600',
            time: 'month'
          }];
          tabItems.some((ele) => ele.key === granularity ? (ele.default = true, true) : false);

          let updateContents = (resourceType, metricType, arr) => {
            let graphs = [{
              title: utils.getMetricName(metricType),
              unit: utils.getUnit(resourceType, metricType),
              yAxisData: utils.getChartData(arr, granularity, timeUtils.getTime(time), resourceType),
              xAxis: utils.getChartData(arr, granularity, timeUtils.getTime(time))
            }];

            contents[tabKey] = (
              <LineChart
                __={__}
                item={rows[0]}
                data={graphs}
                granularity={granularity}
                tabItems={tabItems}
                start={timeUtils.getTime(time)}
                clickTabs={(e, tab, item) => {
                  that.onClickDetailTabs('monitor', refs, {
                    rows: rows,
                    granularity: tab.key,
                    time: tab.time
                  });
                }} />
            );

            update(contents);
          };

          if (data.granularity) {
            updateContents(rule.resource_type, rule.metric, []);
          }

          if (rule.resource_type === 'volume') {
            request.getVolume().then((_data) => {
              let vol = _data.volume.find((ele) => ele.id === rule.resource_id);
              let attch = vol.attachments[0];
              if (attch && attch.server_id) {
                request.getResourceMeasures(attch.server_id, rule.metric, granularity, timeUtils.getTime(time)).then((measures) => {
                  updateContents(rule.resource_type, rule.metric, [measures]);
                }).catch((err) => {
                  updateContents(rule.resource_type, rule.metric, [{}]);
                });
              } else {
                updateContents(rule.resource_type, rule.metric, [{}]);
              }
            });
          } else {
            request.getResourceMeasures(rule.resource_id, rule.metric, granularity, timeUtils.getTime(time)).then((measures) => {
              updateContents(rule.resource_type, rule.metric, [measures]);
            }).catch((err) => {
              updateContents(rule.resource_type, rule.metric, []);
            });
          }
        }
        break;
      case 'history':
        if (isSingle) {
          syncUpdate = false;
          update(contents, true);

          request.getAlarmHistory(rows[0].alarm_id).then((res) => {

            let tableItems = history.getHistoryConfig(res);

            contents[tabKey] = (
              <div>
                <DetailMiniTable
                  __={__}
                  title={__.history}
                  defaultUnfold={true}
                  tableConfig={tableItems} />
              </div>
            );

            update(contents);
          });
        }
        break;
      default:
        break;
    }

    if (syncUpdate) {
      update(contents);
    }
  }

  onDetailAction(tabKey, actionType, data) {
    switch(tabKey) {
      case 'description':
        this.onDescriptionAction(actionType, data);
        break;
      default:
        break;
    }
  }

  onDescriptionAction(actionType, data) {
    switch(actionType) {
      case 'edit_name':
        let { rawItem, newName } = data;
        let newItem = Object.assign({}, rawItem);
        newItem.name = newName;

        request.updateAlarm(newItem.alarm_id, newItem).then((res) => {
          this.refreshForce();
        });
        break;
      case 'add_alarm_notification':
        addNotification(data.rawItem, this.refreshForce);
        break;
      default:
        break;
    }
  }

}

module.exports = Model;
