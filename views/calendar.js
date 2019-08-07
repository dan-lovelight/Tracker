// Create an array of installer objects from a list view on the page
// That displays all the installers visiblie in the calendar on the page
// Object contains details (name, colour etc) required to build the extra calendar filters
function getInstallerDetailsFromListView(view) {
  let installerList = []
  // Create order form download buttons from files table
  $('#' + view + ' .kn-list-item-container').each((index, tableRow) => {
    let installerDetails = {}
    installerDetails.filterString = buildInstallerFilter(tableRow.id)
    installerDetails.filterTitle = $(tableRow).find('.field_869 .kn-detail-body span span')[0].innerText.split(' ')[0]
    installerDetails.colour = $(tableRow).find('.field_1487 .kn-detail-body div')[0].style['background-color']
    installerList.push(installerDetails)
  })
  return installerList
}

// Build an array of filters with each installers colour applied
// This can then be applied to a calendar dynamically
// Prevents having to manually update calendars for installer colours
// Instead users can manage this themselves
function getInstallerColourFiltersFromListView(view) {

  let eventColours = [{
    field: "field_1005",
    operator: "is",
    value: "Tentative",
    color: "#ff0000"
  }]

  $('#' + view + ' .kn-list-item-container').each((index, tableRow) => {
    let eventColour = {}
    eventColour.value = tableRow.id
    eventColour.operator = "contains"
    eventColour.color = $(tableRow).find('.field_1487 .kn-detail-body div')[0].style['background-color']
    eventColour.field = "field_927"
    eventColours.push(eventColour)
  })
  return eventColours
}

// Take a single installer and return a filter string for the installer
function buildInstallerFilter(installerId) {
  return filter = {
    "match": "and",
    "rules": [{
      "field": "field_927",
      "operator": "contains",
      "value": installerId,
      "field_name": "Installers"
    }]
  }
}

// Add an extra filter menu to a calendar, based on the data passed in arrFilters
// arrFilters = {
//  'filterTitle': Lable on the filter,
//  'buttonId': #id of filter button,
//  'filterString': a filter string that will be applied to the calendar when clicked,
//  'colour': the background colour of the button }
// view is the view.key (eg 'view_123')
function createFilterMenuNode(arrExtraFilters, view) {

  let menuId = 'extraFilter' // #id of the new menu

  // Check that the meneu doesn't already exist
  if ($('#' + menuId).length > 0) {
    return
  }

  // Create the parent div for the filter
  let filter = document.createElement('div')
  filter.id = menuId
  filter.classList.add('js-filter-menu', 'tabs', 'is-toggle', 'is-flush')
  filter.style = 'display:inline-block; margin-left:10px'

  // Add a list to hold the filter buttons
  let filterList = document.createElement('ul')

  // For each extra filter, add it to the filter list
  arrExtraFilters.forEach(filter => {
    let listItem = document.createElement('li')
    listItem.addEventListener("click", function() {
      filterView(filter.filterString, view, filter.buttonId) // Apply filter to table when clicked
    });

    let anchor = document.createElement('a')
    let span = document.createElement('span')
    span.innerText = filter.filterTitle
    if (filter.colour === '') {
      anchor.style = `border-color:black;`
      span.style = "color:black"
    } else {
      anchor.style = `border-color:${filter.colour};background-color:${pSBC(0.15, filter.colour)}`
      span.style = "color:white"
    }

    anchor.appendChild(span)
    listItem.appendChild(anchor)
    filterList.appendChild(listItem)
  })

  // Create full menu
  filter.appendChild(filterList)
  return filter
}

//
async function filterView(filterString, view) {
  Knack.models[view].setFilters(JSON.stringify(filterString)) // Turn the filter into a string (in case it's an object)
  //Calling twice is necessary, don't know why
  Knack.models[view].fetch()
  Knack.models[view].fetch()
}

function pimpSchedulingCalendar(view, installerColourKeyList) {
  let installersInCalendar = getInstallerDetailsFromListView(installerColourKeyList) // Get the installer data from the temporary key view
  let eventColours = getInstallerColourFiltersFromListView(installerColourKeyList)
  let newFilter = createFilterMenuNode(installersInCalendar, view) // Build the new filter
  let $insertLocation = $('#' + view + ' div.kn-records-nav') // selector of the element that the new filter will be placed after
  if (newFilter && $insertLocation[0]) $insertLocation[0].insertBefore(newFilter, $insertLocation[0].children[1]); // Add menu to page
  let $menu = $('#' + view + ' div.kn-records-nav div.js-filter-menu')[0]
  if ($menu) $menu.style = 'display:inline-block' // Make menus display next to each other
  $('#' + installerColourKeyList).hide() // Remvoe the temporary key view
  Knack.models[view].view.events.event_colors = eventColours

  // Sometimes duplicate buttons and calendars are added when filtering, don't know why
  if ($('#' + view + ' .fc-header').length > 1) $('#' + view + ' .fc-header')[1].remove()
  if ($('#' + view + ' .fc-content').length > 1) $('#' + view + ' .fc-content')[1].remove()
}

// My calendar
$(document).on('knack-view-render.view_1962', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_1964')
})

// Vic calendar
$(document).on('knack-view-render.view_1347', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_1933')
})

// NSW calendar
$(document).on('knack-view-render.view_2041', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_2043')
})

// QLD calendar
$(document).on('knack-view-render.view_2045', function(event, scene) {
  pimpSchedulingCalendar(scene.key, 'view_2047')
})

// Schedulers requested bookings
$(document).on('knack-scene-render.scene_203', function(event, scene) {
  hideEmptyTables(scene)
})
