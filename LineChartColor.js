{
  id: 'com.oracle.bimad.LineBarChart',
  component: {
    'name': 'Line Bar Chart',
    'tooltip': 'Line Bar Chart is a variation of Bar chart, each bar is represented as a line with label and data values positioned right on top of the line. You can scroll up or down to see more data points. It supports hierarchical data filtering so that you can tap or click on each Line Bar to drill down to the next level.',
    'cssClass': 'line-chart-plugin',
    'icon': 'asset://official-plugin.png'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "1024px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
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
    {name: "color", caption: "Drop Color Field Here", fieldType: "measure", dataType: "number", formula: "summation", optional: true}
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
    this.dataModel.indexColumns().setColumnOrder(['group', 'subgroup']);
    var nested = this.dataModel.nest();
    var self = this;
    var colors = this.getColorScheme(props);
    var indexedFields = this.dataModel.indexedMetaData;
    if (isNaN(parseInt(data[0][3])))
      colors = colors.slice(colors.length - 1);

    this.visualization = new Visualizations.LineChart(container, nested, {
      colors: colors,
      width: props.width,
      height: props.height,
      'background-color': props.background,
      numericFormat: this.getFormatter(indexedFields.size)
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
    var colors = this.getColorScheme(props)
    if (isNaN(parseInt(data[0][3])))
      colors = colors.slice(colors.length - 1);
    //hack to avoid refresh when removing filters from this plugin
    if (!this.avoidRefresh) {
      var self = this;
      var parent = this.visualization.container.select('.line-chart');
      this.dataModel.setData(data).indexColumns();
      this.visualization.setColors(colors)
          .setData(this.dataModel.nest());
      this.visualization.removeChildren(parent.node()).done(function () {
        self.visualization.render(null, parent);
      });
    }
    this.avoidRefresh = false;
  },
  getFormatter: function (field, props) {
    if (xdo.api.format && field.dataType === 'number')
      return xdo.api.format(field.dataType, field.formatMask);

    return Utils.format('thousands');
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
