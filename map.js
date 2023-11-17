//python -m http.server (in directory) and then localhost:port to connect
class Well
{

  constructor(uwid, start, end, path, color, risk, icon, op)
  {
    this.uwid = uwid;
    this.path = path;
    this.color = color;
    this.start = start;
    this.end = end;
    this.risk = risk;
    this.icon = icon;
    this.op = op;
  }

  draw(map)
  {
    //first clear it so there's no double drawing scenario
    this.hideWell();

    console.log('drawing uwid: ' + this.uwid);

    this.drawnPath = drawPath(map, this.path, this.color);
   
    this.drawnStart = drawStart(map, this);
    this.drawnEnd = drawEnd(map, this);
  }

  drawArea(map, radius, factor)
  {
    //first clear the radius, this does nothing if it doesn't already exist
    this.clearRadius();

    console.log('drawing radius for uwid: ' + this.uwid);
    this.drawnArea = drawRadius(map, this.path, radius, factor);
    drawnAreas.set(this.uwid, radius + ',' + factor);
  }

  hideWell()
  {
    console.log('hiding uwid: ' + this.uwid);

    if('drawnPath' in this) this.drawnPath.setMap(null);
    if('drawnStart' in this) this.drawnStart.setMap(null);
    if('drawnEnd' in this) this.drawnEnd.setMap(null);
    this.clearRadius();
  }

  clearRadius()
  {
    //if property doesn't exist, don't attempt to clear
    if(!('drawnArea' in this)) return;

    console.log('clearing radius for UWID: ' + this.uwid);
    for(var i = 0; i < this.drawnArea.length; i++)
    {
      this.drawnArea[i].setMap(null);
    }

    drawnAreas.delete(this.uwid);
  }


}

const sheetID = '72900543';
const sheetKey = 'AIzaSyD6Ic-Sx4PUXKdUweNhjZEi7hzKGJ3QGGU';
const clientID = '961472646552-8vvhsv52p1fd6256k3k5vdmbnt349i7s.apps.googleusercontent.com';
const clientSecret = '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';
const host = "https://clrh2o-ca.github.io";

let wells = [];
let map;

const risks = new Set();
const ops = new Set();
const drawnAreas = new Map();

//set of applied filters (always hide)
const filters = new Set();

window.initMap = initMap;

//paths.add(well1);

function initMap() 
{

  //this section will extract data from the speadsheet
  (async() => 
  {
    const data = await (await fetch(host + '/data.xlsx')).arrayBuffer();
    /* data is an ArrayBuffer */
    const workbook = XLSX.read(data);

    /* DO SOMETHING WITH workbook HERE */

    //load filters from URL
    let tempFilter = findGetParameterJSON('filters');
    if(tempFilter === null) tempFilter = [];

    let rows = XLSX.utils.sheet_to_row_object_array(workbook.Sheets.Sheet1);
    //console.log(rows[1000]);
    for(var i = 0; i < rows.length; i++)
    {
      //skip the row if it's missing a UWI
      if(!('Unique Well Identifier (UWI)' in rows[i])) continue;

      let path = [];
      let start = {lat: Number(rows[i]['Surface_lat']), lng: Number(rows[i]['Surface_long'])};
      path.push(start);
      for(var l = 2; l <= 19; l++)
      {
        //for some unknown reason ICP is point 5
        if(l == 5)
        {
          if('ICP Latitude' in rows[i])
          {
            path.push({lat: Number(rows[i]['ICP Latitude']), lng: Number(rows[i]['ICP Longitude'])});
          }
        }

        else
        {
          if(('LatS' + l) in rows[i])
          {
            path.push({lat: Number(rows[i]['LatS' + l]), lng: Number(rows[i]['LongS' + l])});
          }
        }
      }

  
      let end = {lat: Number(rows[i]['BH Latitude']), lng: Number(rows[i]['BH Longitude'])};
      path.push(end);

      let icon = host + '/icons/';
      switch(rows[i]['Well Symbol'])
      {
        case 'Gas':
          icon += '_icon_gas';
          break;
        case 'Abandoned':
          icon += '_icon_abandoned';
          break;
        case 'Oil':
          icon += '_icon_oil';
          break;
        case 'Surface':
          icon += '_icon_surface';
          break;
        case 'Licensed':
          icon += '_icon_licensed';
          break;
        default:
          icon += '_icon_other';
      }

      let colour = '#000000';
      switch(rows[i]['Risk Level'])
      {
        case 'LOW':
          //green
          colour = '#32a852';
          icon += '_low.png';
          break;
        case 'HIGH':
          //red
          colour = '#ad1a1c';
          icon += '_high.png';
          break;
        case 'SUBJECT WELL':
          //blue
          colour = '#1152c2';
          icon += '_subject.png';
          break;
        default:
          colour = '#000000';
          icon += '.png';
      }

      ops.add(rows[i]['Current Operator']);
      risks.add(rows[i]['Risk Level']);

      let well = new Well(rows[i]['Unique Well Identifier (UWI)'], start, end, path, colour, rows[i]['Risk Level'], icon, rows[i]['Current Operator']);
      wells.push(well);

      //create the map on first loop
      if(i === 0)
      {
        const start = wells[0].start;
        const zoom = 12;


        map = new google.maps.Map(document.getElementById("map"), {
          zoom: zoom,
          center: start,
        });
      }

      //draw wells here
      wells[i].draw(map);

      let div = $('<div class="filter">' + rows[i]['Unique Well Identifier (UWI)'] + '</div>');
      $('#wells').append(div);
      div.on('click', function()
      {
        filter(well.uwid);
        $(this).toggleClass('strike');
      });
      if(tempFilter.includes(well.uwid))
      {
        div.addClass('strike');
        filter(well.uwid);
      }
    }


    for(const op of ops)
    {
      div = $('<div class="filter">' + op + '</div>');
      $('#ops').append(div);
      div.on('click', function()
      {
        filter(op);
        $(this).toggleClass('strike');
      });

      if(tempFilter.includes(op))
      {
        div.addClass('strike');
        filter(op);
      }
    }

    for(const risk of risks)
    {
      div = $('<div class="filter">' + risk + '</div>');
      $('#risks').append(div);
      div.on('click', function()
      {
        filter(risk);
        $(this).toggleClass('strike');
      });

      if(tempFilter.includes(risk))
      {
        div.addClass('strike');
        filter(risk);
      }
    }

    //draw areas
    let tempAreas = findGetParameter('areas');
    if(tempAreas === null) tempAreas = '';

    //drawing is packaged as a long string UWID-xxxxxxxxxxx,20,10| => UWID|radius,factor
    $.each(tempAreas.split('|'), function(i, val)
    {
      if(val === '') return;

      let a = val.split(',');
      wells.find(e => e.uwid == a[0]).drawArea(map, Number(a[1]), Number(a[2]));
    });

  })();
  
}

//very important filter function
//everything is assumed to be shown, an applied filter is always a hide filter
function filter(target)
{
  //type 0 is well id
  //type 1 is risk
  //type 2 is operator'

  //handle tracking the applied filteres and whether or not this is a hide or show operation
  let hide = true;

  if(filters.has(target))
  {
    filters.delete(target);
    hide = false;
  }
  else filters.add(target);

  //check each well if it has the right UWID, then either hide or show depending on filter
  for(var i = 0; i < wells.length; i++)
  {
    let well = wells[i];
    if(well.uwid == target || well.risk == target || well.op == target)
    {
      console.log(hide);
      (hide ? well.hideWell() : well.draw(map));
    }
  }
}

function createUrl()
{
  let url = host + '/index.html?';
  if(!(filters.size === 0))
  {
    let arr = Array.from(filters);
    url += '&filters=' + encodeURIComponent(JSON.stringify(arr));
  }

  if(!(drawnAreas.size === 0))
  {
    let areaString = ''
    drawnAreas.forEach((val, key) => 
    {
      areaString += key + ',' + val + '|';
    });

    url += '&areas=' + areaString;
  } 
  
  navigator.clipboard.writeText(url);
}

function toggleSidebar()
{
  $('#risks').toggle();
  $('#ops').toggle();
  $('#wells').toggle();
  $('#shareButton').toggle();
  $('#risks').css('display') == 'none' ? $('#toggleButton').html('>') : $('#toggleButton').html('<');
}

function findGetParameterJSON(parameterName) 
{
  var result = null,
      tmp = [];
  location.search
      .substr(1)
      .split("&")
      .forEach(function (item) {
        tmp = item.split("=");
        if (tmp[0] === parameterName) result = JSON.parse(decodeURIComponent(tmp[1]));
      });
  return result;
}

function findGetParameter(parameterName) 
{
  var result = null,
      tmp = [];
  location.search
      .substr(1)
      .split("&")
      .forEach(function (item) {
        tmp = item.split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
      });
  return result;
}


//FOR SOME REASON THESE DRAW FUNCTIONS CAN"T BE IN THE CLASS BECAUSE google.maps DOESN"T EXIST YET


//https://stackoverflow.com/questions/19369363/how-to-draw-a-polygon-around-a-polyline-in-javascript?answertab=trending#tab-top
function drawRadius(map, path, radius, factor)
{
  //radius is given as half length
  radius *= 2;

  let radial = [];
  overviewPathGeo = [];
  
  for (var i = 0; i < path.length; i++) {
     overviewPathGeo.push(
        [path[i].lng, path[i].lat]
     );
  }
  

  var distance = (radius/1000.0) / 111.12, // Roughly 10km
  geoInput = {
  type: "LineString",
      coordinates: overviewPathGeo
  };
  var geoReader = new jsts.io.GeoJSONReader(),
      geoWriter = new jsts.io.GeoJSONWriter();
  var geometry = geoReader.read(geoInput).buffer(distance);
  var polygon = geoWriter.write(geometry);

  var oLanLng = [];
  var oCoordinates;
  oCoordinates = polygon.coordinates[0];
  for (i = 0; i < oCoordinates.length; i++) {
     var oItem;
     oItem = oCoordinates[i];
     oLanLng.push(new google.maps.LatLng(oItem[1], oItem[0]));
  }

  var polygone = new google.maps.Polygon({
      paths: oLanLng,
      fillColor: '#fa8072',
      map:map
  });

  radial.push(polygone);


  distance = ((radius*factor)/1000.0) / 111.12, // Roughly 10km
  geoInput = {
  type: "LineString",
      coordinates: overviewPathGeo
  };
  geoReader = new jsts.io.GeoJSONReader(),
  geoWriter = new jsts.io.GeoJSONWriter();
  geometry = geoReader.read(geoInput).buffer(distance);
  polygon = geoWriter.write(geometry);

  oLanLng = [];
  oCoordinates;
  oCoordinates = polygon.coordinates[0];
  for (i = 0; i < oCoordinates.length; i++) {
     var oItem;
     oItem = oCoordinates[i];
     oLanLng.push(new google.maps.LatLng(oItem[1], oItem[0]));
  }

  polygone = new google.maps.Polygon({
      paths: oLanLng,
      fillColor: '#fa8072',
      map:map
  });

  radial.push(polygone);

  return radial;
}


function drawPath(map, path, color)
{
  const wellPath = new google.maps.Polyline(
  {
    path: path,
    geodesic: true,
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: 3.5,
    map,
  });

  return wellPath;
}

//this also includes the info window
function drawEnd(map, well)
{
    //have to do all of this to attach a click to the button

    //main parent div
    const infoDisplay = document.createElement('div');

    //info about well
    const info = document.createElement('p');
    $(info).html('UWID: ' + well.uwid);
    //more stuff here

    //input box for radius
    const radBox = document.createElement('input');
    $(radBox).attr('type', 'text');
    $(radBox).attr('value', '400');
    $(radBox).attr('placeholder', 'half-length (m)');

    //input box for factor
    const factor = document.createElement('input');
    $(factor).attr('type', 'text');
    $(factor).attr('value', '2');
    $(factor).attr('placeholder', 'factor');

    //draw area button
    const display = document.createElement('input');
    $(display).attr('type', 'button');
    $(display).attr('value', 'Draw Radius');
    $(display).click(function()
    {
      well.drawArea(map, parseInt($(radBox).val()), parseInt($(factor).val()));
    });
   
    //clear button
    const clear = document.createElement('input');
    $(clear).attr('type', 'button');
    $(clear).attr('value', 'Clear Radius');
    $(clear).click(function()
    {
      well.clearRadius();
    });

    //add all created elements to parent div
    $(infoDisplay).append(info, radBox, factor, display, clear);

    //create info window
    const infowindow = new google.maps.InfoWindow(
    {
      content: infoDisplay,
    });

    const icon = {
      url: well.icon, // url
      scaledSize: new google.maps.Size(25, 25), // scaled size
      origin: new google.maps.Point(0, 0), // origin
      anchor: new google.maps.Point(12.5, 12.5) // anchor
    };


    //create start marker
    const marker = new google.maps.Marker(
    {
      position: well.end,
      map,
      title: well.uwid,
      icon: icon,
    });

    //make infowindow appear onclick of start marker
    marker.addListener('click', () => 
    {
      infowindow.open({
        anchor: marker,
        map,
        shouldFocus: false,
      });
    });

    return marker;
}

function drawStart(map, well)
{
  let url = './icons/_icon_surface';
  switch(well.risk)
  {
    case 'LOW':
      //green
      url += '_low.png';
      break;
    case 'HIGH':
      //red
      url += '_high.png';
      break;
    case 'SUBJECT WELL':
      //blue
      url += '_subject.png';
      break;
    default:
      url += '.png';
  }

  const icon = {
    url: url, // url
    scaledSize: new google.maps.Size(20, 20), // scaled size
    origin: new google.maps.Point(0, 0), // origin
    anchor: new google.maps.Point(10, (well.risk == 'SUBJECT WELL' ? 20 : 10)) // anchor
  };

  const marker = new google.maps.Marker(
  {
    position: well.start,
    map,
    title: well.uwid,
    icon: icon,
  });

  return marker;
}
