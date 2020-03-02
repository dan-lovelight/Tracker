// Scheduling calendar
$(document).on('knack-view-render.view_1962 knack-view-render.view_2432', function(event, view) {

  // Insert filters and other custom features
  if(view.key === 'view_1962') pimpSchedulingCalendar(view.key, 'view_1964') // OLD
  if(view.key === 'view_2432') pimpSchedulingCalendar(view.key, 'view_2510') // NEW

  // Hide the requested callouts table
  $('#view_2325').hide() // OLD
  $('#view_2511').hide() // NEW
})

// Scheduling calendar modals loaded
$(document).on('knack-modal-render', function(event, modal) {

  // Exit unless on of the calendars we're targetting
  if(!event.handleObj.namespace === "view_1962" || !event.handleObj.namespace === "view_1962") return

  // There are multiple modals that can pop up from interaction with the calendar
  // However there is no native way to identify them from each other
  // To detect the add event modal, the class 'add-event-modal' has been manually added to the title in the builder
  if (modal.modal[0].innerHTML.indexOf('add-event-modal') > -1) {

    const after = setInterval(async function() {
      let visibleModal = $('.add-event-modal')
      if (visibleModal.length > 0) {
        // Execute after function
        clearInterval(after)
        // Add the requested callouts table
        $('#view_2325').clone().prependTo('#cal_entry_view').css('display', 'block') // OLD
        $('#view_2511').clone().prependTo('#cal_entry_view').css('display', 'block') // NEW
        // Hide the date picker that for some reason pops up
        $('#ui-datepicker-div').css('display', 'none')
      }
    })
  }
})

// Get the date that has been selected
$(document).on('knack-form-submit.view_1962 knack-form-submit.view_2432', function(event, view, record) {
  window.selectedTime = {
    fromDate: record.field_924_raw.date_formatted,//$('#view_1962-field_924')[0].value,
    fromTime: `${record.field_924_raw.hours}:${record.field_924_raw.minutes}${record.field_924_raw.am_pm.toLowerCase()}`,//$('#view_1962-field_924-time')[0].value,
    toTime: `${record.field_924_raw.to.hours}:${record.field_924_raw.to.minutes}${record.field_924_raw.to.am_pm.toLowerCase()}`,//$('#view_1962-field_924-time-to')[0].value,
    toDate: record.field_924_raw.to.date_formatted,//$('#view_1962-field_924-to')[0].value,
  }
})

// Scheduling calendar modals closed
$(document).on('knack-modal-close.view_1962 knack-modal-close.view_2432 ', function(event, modal) {
  window.selectedTime = undefined
})

// Detect if the shift key is being held. This is used for applying multiple fitlers
$(document).on('keyup keydown', function(e) {
  window.shifted = e.ctrlKey
})

function pimpSchedulingCalendar(viewKey, installerColourKeyList) {
  let installersInCalendar = getInstallerDetailsFromListView(installerColourKeyList) // Get the installer data from the temporary key view
  let eventColours = getInstallerColourFiltersFromListView(installerColourKeyList)
  let newFilter = createFilterMenuNode(installersInCalendar, viewKey) // Build the new filter
  let $insertLocation = $('#' + viewKey + ' div.kn-records-nav') // selector of the element that the new filter will be placed after
  if (newFilter && $insertLocation[0]) $insertLocation[0].insertBefore(newFilter, $insertLocation[0].children[1]); // Add menu to page
  let $menu = $('#' + viewKey + ' div.kn-records-nav div.js-filter-menu')[0]
  if ($menu) $menu.style = 'display:inline-block' // Make menus display next to each other
  $('#' + installerColourKeyList).hide() // Hide the temporary key view
  Knack.models[viewKey].view.events.event_colors = eventColours

  // Sometimes duplicate buttons and calendars are added when filtering, don't know why
  if ($('#' + viewKey + ' .fc-header').length > 1) $('#' + viewKey + ' .fc-header')[1].remove()
  if ($('#' + viewKey + ' .fc-content').length > 1) $('#' + viewKey + ' .fc-content')[1].remove()

  // Apply updates to event tiles once they are available.
  waitForAddedNode({
    class: 'fc-event',
    parent: document.querySelector(`#${viewKey}`),
    recursive: true,
    done: processCalendarEvents,
    viewKey: viewKey
  })

}


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
    installerDetails.installerId = $(tableRow)[0].id
    installerDetails.phone = $(tableRow).find('.field_1083 .kn-detail-body span span')[0].innerText ? $(tableRow).find('.field_1083 .kn-detail-body span span')[0].innerText .replace('+61','0') : ''
    installerList.push(installerDetails)
  })

  installerList.sort((a, b) => {
    var textA = a.filterTitle.toUpperCase();
    var textB = b.filterTitle.toUpperCase();
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
  })

  return installerList
}

// Build an array of filters with each installers colour applied
// This can then be applied to a calendar dynamically
// Prevents having to manually update calendars for installer colours
// Instead users can manage this themselves
function getInstallerColourFiltersFromListView(view) {

  let eventColours = []

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
    "field": "field_927",
    "operator": "contains",
    "value": installerId,
    "field_name": "Installers"
  }
  // return filter = {
  //   "match": "and",
  //   "rules": []
  // }
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

  let filter = document.createElement('div') // Create the parent div for the filter
  let filterList = document.createElement('ul') // Add a list to hold the filter buttons
  let phoneDisplay = document.createElement('div') // A div to display the selected installer's number

  filter.id = menuId
  filter.classList.add('js-filter-menu', 'tabs', 'is-toggle', 'is-flush')
  filter.style = 'display:inline-block; margin-left:10px'

  // For each extra filter, add it to the filter list
  arrExtraFilters.forEach(filter => {

    let listItem = document.createElement('li')
    let anchor = document.createElement('a')
    let span = document.createElement('span')

    listItem.addEventListener("click", function() {

      // If the appliedFilters variable (that keeps track of what's been applied between refreshses) doesn't exist, create it
      if (!window.appliedFilters) window.appliedFilters = []

      // Get the currently applied filters
      let newFilter = Knack.models[view].view.filters

      // Apply the new filter - check if shift is held or not
      if (window.shifted) {
        newFilter.match = 'or'
        newFilter.rules.push(filter.filterString)
        window.appliedFilters.push(filter.installerId)
      } else {
        newFilter.rules = [filter.filterString]
        window.appliedFilters = [filter.installerId]
      }

      // Apply the new filter to the view
      Knack.models[view].setFilters(JSON.stringify(newFilter))

      //Refresh the view. Calling twice is necessary, don't know why
      Knack.models[view].fetch()
      Knack.models[view].fetch()
    });

    if (filter.colour === '') {
      anchor.style = `border-color:black;`
      span.style = "color:black"
    } else {
      anchor.style = `border-color:${filter.colour};background-color:${pSBC(0.15, filter.colour)}`
      span.style = "color:white"
    }

    // Is this filter selected?
    if (window.appliedFilters && window.appliedFilters.includes(filter.installerId)) {

      // Indicate the selected state
      listItem.className = "is-active"
      span.innerHTML = `<strong>${filter.filterTitle}</strong>`

      // Create the phone number display elementlet phoneDisplay = document.createElement('div')
      if (phoneDisplay.innerText !== '') {
        phoneDisplay.innerText += ` | ${filter.filterTitle}: ${filter.phone}`
      } else {
        phoneDisplay.innerText = `${filter.filterTitle}: ${filter.phone}`
        phoneDisplay.id = 'installerPhone'
        phoneDisplay.style = 'display:inline-block; margin-left:10px'
      }

    } else {
      span.innerHTML = filter.filterTitle
    }

    anchor.appendChild(span)
    listItem.appendChild(anchor)
    filterList.appendChild(listItem)
  })

  // Create full menu
  filter.appendChild(filterList)

  // Add the phone number display
  let $insertLocation = $('#' + view + ' div.kn-records-nav') // selector of the element that the new filter will be placed after
  if ($insertLocation[0]) $insertLocation[0].insertBefore(phoneDisplay, $insertLocation[0].children[1]); // Add menu to page

  return filter
}

function waitForAddedNode(params) {
  new MutationObserver(function(mutations) {
    var el = document.getElementsByClassName(params.class);
    if (el) {
      //this.disconnect();
      params.done(el, params.viewKey);
    }
  }).observe(params.parent || document, {
    subtree: !!params.recursive,
    childList: true,
  });
}

function processCalendarEvents(elements, viewKey) {
  colourMultiPersonEvents(elements)
  colourTenativeEvents(elements)
  addPopOvers(elements, viewKey)
}

function colourMultiPersonEvents(elements) {
  for (let event of elements) {
    if (event.innerText.includes('👤👤')) {
      let eventDetails = event.innerHTML
      let searchString = '<span style="background-color:'
      let backgroundColours = []
      while (eventDetails.indexOf(searchString) > 0) {
        let position = eventDetails.indexOf(searchString) + searchString.length
        eventDetails = eventDetails.substring(position)
        backgroundColours.push(eventDetails.substring(0, eventDetails.indexOf('"')))
      }
      let background = 'linear-gradient(145deg'
      let numberOfColours = backgroundColours.length
      let percentColoured = 0
      backgroundColours.forEach(colour => {
        background += `,${colour} ${percentColoured}% ${percentColoured + 100/numberOfColours}%`
        percentColoured = percentColoured + 100 / numberOfColours
      })
      background += ')'
      background = background.replace(/;/g,'')
      event.children[0].style.background = background
      event.children[0].children[0].style.background = background
      event.innerHTML = event.innerHTML.replace(/👤/g, '')
    }
  }
}

function colourTenativeEvents(elements) {
  let $eventHeader = $('.fc-event-time').not('is-tentative-styled')
  $eventHeader.each((index, element) => {
    if (element.parentElement.parentElement.innerText.includes('❓')) {
      $(element).addClass("is-tentative-styled");
      $(element).css({
        'background': 'none',
        'background-color': 'red',
        'border-color': 'red'
      })
      $(element.parentElement.parentElement.parentElement).css({
        'background': 'none',
        'background-color': 'red',
        'border-color': 'red'
      })
    }
  })
}

function addPopOvers(elements, viewKey) {
  let $events = $('.fc-event').not('.has-tooltip')
  $events.each((index, element) => {
    $(element).addClass("has-tooltip");
    if ($(element).find('span[id]').length > 0) {
      let eventId = $(element).find('span[id]')[0].id
      let eventDetails = Knack.models[viewKey].data.models.find(event => event.attributes.id === eventId).attributes
      let eventName = eventDetails.field_1488
      let startTime = `${eventDetails.field_924_raw.hours}:${eventDetails.field_924_raw.minutes}${eventDetails.field_924_raw.am_pm.toLowerCase()}`
      let endTime = `${eventDetails.field_924_raw.to.hours}:${eventDetails.field_924_raw.to.minutes}${eventDetails.field_924_raw.to.am_pm.toLowerCase()}`
      let installers = eventDetails.field_927
      let suburb = eventDetails.field_981_raw ? eventDetails.field_981_raw.city : ''
      let tooltipContents = `<div><strong>${eventName}</strong><hr>`
      tooltipContents += `<div><table style="font-size: .9em;" align="center"><tr><td><strong>Start</strong></td><td>${startTime}</td></tr><tr><td><strong>End</strong></td><td>${endTime}</td></tr><tr><td><strong>Suburb</strong></td><td>${suburb}</td></tr><tr><td><strong>Installers</strong></td><td>${installers}</td></tr></table></div></div>`
      let tooltip = new Tooltip(element, {
        placement: 'right',
        title: tooltipContents, //,
        html: true,
      })
    }
  })
}


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
