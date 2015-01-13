{
  id: '03efcb62a28c.LineChartColorColumn',
  component: {
    'name': 'Line Chart Color Colum',
    'tooltip': 'Insert Line Chart'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "320px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "numberformat", label: "Numeric Format", type: "lov", options: [
      {label: 'Raw', value: 'raw'},
      {label: 'Currency', value: 'currency'},
      {label: 'Thousands separated', value: 'thousands'}
    ]},
    {key: "currencysymbol", label: "Currency Symbol", type: "string", value: ""},
    {key: "background", label: "Background Color", type: "color", value: '#fff'},
    {key: "startcolor", label: "Start Color", type: "color", value: '#ff1300'},
    {key: "middlecolor", label: "Middle Color", type: "color", value: '#ff8c00'},
    {key: "endcolor", label: "End Color", type: "color", value: '#46b319'},
    {key: "invert", label: "Invert Colors", type: "bool", value: false}
  ],
  remoteFiles: [
    {
      type:'js',
      location: 'asset://js/LineChart.concat.js',
      isLoaded: function() {
        return 'Visualizations' in window && 'LineChart' in Visualizations;
      }
    },
    {
      type:'css',
      location:'asset://css/style.css'
    }
  ],
  fields: [
    {name: "group", caption: "Drop Main Group Field Here", fieldType: "label", dataType: "string"},
    {name: "subgroup", caption: "Drop Subgroup Field Here", fieldType: "label", dataType: "string"},
    {name: "size", caption: "Drop Size Field Here", fieldType: "measure", dataType: "number", formula: "summation"},
    {name: "color", caption: "Drop Color Field Here", fieldType: "measure", dataType: "number", formula: "summation"}
  ],
  dataType: 'arrayOfArrays',
  avoidRefresh: false,
  getColorScheme: function (props) {
    var colors = [props.startcolor, props.middlecolor, props.endcolor];
    var invert = props.invert;
    if (typeof invert !== 'boolean') {
      invert = invert === 'false' ? false : true;
    }
    if (invert)
      colors.reverse();
    return colors;
  },
  render: function (context, container, data, fields, props) {
    container.innerHTML = '';
    this.dataModel = new Utils.DataModel(data, fields);
    this.dataModel.indexColumns().setColumnOrder(['group', 'subgroup', 'size', 'color']);
    var nested = this.dataModel.nest();
    var self = this;

    this.visualization = new Visualizations.LineChart(container, nested, {
      colors: this.getColorScheme(props),
      width: props.width,
      height: props.height,
      'background-color': props.background,
      numericFormat: Utils.format(props.numberformat, {symbol: props.currencysymbol})
    });
    this.visualization.render();
    this.visualization.addEventListener('filter', function (filters) {
      filters = self.constructFilters(filters, context);
      xdo.api.handleClickEvent(filters);
      this.updateFilterInfo(filters.filter);
      console.log(filters);
    }).addEventListener('remove-filter', function (filters) {
      self.avoidRefresh = true;
      filters.forEach(function (filter) {
        try{
             xdo.app.viewer.GlobalFilter.removeFilter(context.id, filter.id);
        } catch (e) {}
      });
    });

  },
  refresh: function (context, container, data, fields, props) {
    //hack to avoid refresh when removing filters from this plugin
    if (!this.avoidRefresh) {
      var self = this;
      var parent = this.visualization.container.select('.line-chart');
      this.dataModel.setData(data).indexColumns();
      this.visualization.setColors(this.getColorScheme(props))
          .setData(this.dataModel.nest());
      this.visualization.removeChildren(parent.node()).done(function () {
        self.visualization.render(null, parent);
      });
    }
    this.avoidRefresh = false;
  },
  constructFilters: function (data, context) {
    var group = this.dataModel.indexedMetaData.group.field;
    var filters = [];
    var children;
    for (var key in data) {
      filters.push({field: group, value: data[key].name});
    }

    return {
      id: context.id,
      filter: filters
    };
  }

}