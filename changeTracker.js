// Knack object has two sets of methods:
//
// 1) For manipulating records
// .create(data)
// .get(id)
// .update(id, data)
// .find(filters, [sortField], [sortOrder], [recordPerPage])
//
// 2) For capturing changes
// .onCreate(callback)
// .onUpdate(callback)
// .onDelete(callback)
// All three of these functions return 5 arguements to the callback:
// callback(view, record, user, previousRecord, changes)

class KnackObject {
  constructor(objectKey, view) {
    this.key = objectKey
    this.view = view

    let objectDetails = Knack.objects.models.filter(object => object.id === objectKey)[0]
    this.name = objectDetails.attributes.name
    this.fields = {}
    objectDetails.attributes.fields.forEach(field => {
      this.fields[field.key] = {
        'name': field.name,
        'type': field.type,
        'required': field.required,
      }
    })
  }

  set key(newKey) {
    this._key = newKey
  }
  get key() {
    return this._key
  }
  set view(newView) {
    this._view = newView
    this._isValidView = false
    if (!newView) {
      return // no view provided
    } else if (!newView.source) {
      return // view is a menu
    } else if (!newView.source.object === this.key) {
      return // view is not for the target object
    } else {
      this._isValidView = true
    }
  }
  get view() {
    return this._view
  }

  async create(data = {}) {

    this._assert(this.headers, this.errorMsgs.noHeaders)

    let url = this.knackURL + 'objects/' + this.key + '/records/'
    let init = {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    }
    return await this._goFetch(url, init)
  }

  async get(id) {

    this._assert(this.headers, this.errorMsgs.noHeaders)

    let url = this.knackURL + 'objects/' + this.key + '/records/' + id
    let init = {
      method: 'GET',
      headers: this.headers
    }

    return await this._goFetch(url, init)

  }

  async update(id, data = {}) {

    this._assert(this.headers, this.errorMsgs.noHeaders)

    let url = this.knackURL + 'objects/' + this.key + '/records/' + id
    let init = {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data)
    }

    return await this._goFetch(url, init)

  }

  async find(filters = [], sortField = '', sortOrder = '', recordPerPage = 'all') {

    this._assert(this.headers, this.errorMsgs.noHeaders)

    let filtersEnc = encodeURI(JSON.stringify(filters))
    let sortOrderEnc = encodeURI(JSON.stringify(sortOrder))
    let sortFieldEnc = encodeURI(JSON.stringify(sortField))

    let url = this.knackURL + 'objects/' + objectId + '/records?rows_per_page=' + recordPerPage +
      '&filters=' + filtersEnc + "&sort_field=" + sortFieldEnc + "&sort_order=" +
      sortOrderEnc

    let init = {
      method: 'GET',
      headers: this.headers
    }

    return await this._goFetch(url, init)

  }

  onCreate(callback) {

    this._assert(this.headers, this.errorMsgs.noHeaders)
    this._assert(this._isValidView, this.errorMsgs.noView)

    let self = this
    if (this.view.action !== 'insert') return
    if (this._isListenerAlreadyApplied('create', callback)) return

    // Listen for new records
    $(document).on(`knack-record-create.${this.view.key}`, function(event, view, record) {
      callback(view, record, self.user, {}, [])
    })

  }

  async onUpdate(callback) {

    this._assert(this.headers, this.errorMsgs.noHeaders)
    this._assert(this._isValidView, this.errorMsgs.noView)

    let self = this
    let recordBefore = {}

    // Handle update forms
    if (this.view.type === 'form' && this.view.action === 'update') {
      recordBefore = await this.get(this.view.scene.scene_id)
      // Only add global listeners once
      if (!this._isListenerAlreadyApplied('update', callback)) {
        $(document).on(`knack-record-update.${this.view.key}`, recordUpdateHandler)
        return // No action links on forms, exit here
      }
    }

    // Handle tables that allow inline edits
    if (this.view.type === 'table' && this.view.options.cell_editor) {
      // This needs to be a global variable - knack listeners are only added once, but the data can change after sorting, paging etc
      window.dataBefore = JSON.parse(JSON.stringify(Knack.views[this.view.key].model.data.models))
      // Only add global listeners once
      if (!this._isListenerAlreadyApplied('update', callback)) {
        $(document).on(`knack-cell-update.${this.view.key}`, cellUpdateHandler)
      }
    }

    function recordUpdateHandler(event, view, record) {
      compareAndReturn(record, recordBefore)
      // Reset the baseline
      recordBefore = record
    }

    function cellUpdateHandler(event, view, record) {
      // Identify the original record
      recordBefore = dataBefore.filter(recordInTable => recordInTable.id === record.id)[0]

      // Build a complete previous record
      Object.keys(record).forEach(key => {
        if (recordBefore[key] === undefined) recordBefore[key] = record[key]
      })

      // Just in case the view doesn't re-render, need to update our baseline data
      window.dataBefore = JSON.parse(JSON.stringify(Knack.views[view.key].model.data.models))

      compareAndReturn(record, recordBefore)
    }

    // Handle views with action links (tables & view details)
    let $actionLinks = $('#' + this.view.key + ' .kn-action-link')
    if ($actionLinks.length > 0) {
      this._isListenerAlreadyApplied('update', callback)
      waitForActionLinkEvents()
    }

    function waitForActionLinkEvents() {
      if (typeof $._data($actionLinks[0]).events !== "undefined") {
        interceptActionLinks()
      } else {
        setTimeout(waitForActionLinkEvents, 250);
      }
    }

    async function interceptActionLinks() {
      // Get the listner currently attached to the element
      let clickListener = $._data($actionLinks[0]).events.click[0];
      // Detatch the click event
      $actionLinks.off('click')
      // Replace the click event with our own
      $actionLinks.click(async function(event) {
        let recordId = self.view.type === 'table' ? $(event.currentTarget).closest('tr').attr('id') : $actionLinks[0].baseURI.split('/').slice(-2).reverse().pop()
        // Execute before function
        let recordBefore = await self.get(recordId)
        // Trigger the original click event
        clickListener.handler(event)
        // Instead, wait for the spinner to disappear before triggering the after function
        const after = setInterval(async function() {
          let spinner = document.getElementById('kn-loading-spinner')
          let displayStyle = window.getComputedStyle(spinner, null)['display']
          if (displayStyle === 'none') {
            // Execute after function
            clearInterval(after)
            let record = await self.get(recordId)
            compareAndReturn(record, recordBefore)
          }
        })
      })
    }

    function compareAndReturn(record, recordBefore) {
      let changes = []
      // Compare before and after
      Object.keys(record).forEach(key => {
        if (recordBefore[key] !== record[key] && key.indexOf('raw') < 0) changes.push(key)
      })
      // Pass to callback if there are changes
      if (changes.length > 0) callback(self.view, record, self.user, recordBefore, changes)
    }

  }

  async onDelete(callback) {

    this._assert(this.headers, this.errorMsgs.noHeaders)
    this._assert(this._isValidView, this.errorMsgs.noView)

    let self = this
    let record = false
    let recordId
    let detailsView = false

    // Add our own click listener if there are delete links
    let $deleteLinks = $('#' + this.view.key + ' .kn-link-delete')
    if ($deleteLinks.length > 0) {
      if (this.view.type === 'table') {
        interceptDeleteLinks()
      } else {
        detailsView = true
        waitForDeleteEvents()
      }
    }

    function waitForDeleteEvents() {
      if (typeof $._data($deleteLinks[0]).events !== "undefined") {
        interceptDeleteLinks()
      } else {
        setTimeout(waitForDeleteEvents, 250);
      }
    }

    async function interceptDeleteLinks() {

      $deleteLinks.click(async function(event) {
        // Only add global listeners once
        if (!self._isListenerAlreadyApplied('delete', callback)) {
          $(document).on(`knack-record-delete.${self.view.key}`, function() {
            waitForRecord()
          })
          if (!detailsView) {
            recordId = $(event.currentTarget).closest('tr').attr('id')
            record = await self.get(recordId)
          }
        }
      })

      // For details view, load the full record immediately - not reliable doing it on click
      if (detailsView) {
        recordId = $deleteLinks[0].baseURI.split('/').slice(-2).reverse().pop()
        record = await self.get(recordId)
      }

      function waitForRecord() {
        if (record) {
          callback(self.view, record, self.user, {}, [])
        } else {
          console.log('had to wait')
          setTimeout(waitForRecord, 250);
        }
      }
    }
  }

  static fields(fields) {
    if (!fields) {
      // No params, return all fields
      return this.fields
    } else if (typeof fields === 'string') {
      // Single field string, return object details for this string
      return this.fields.filter(field => field.keys === fields)[0]
    } else if (typeof fields === 'array') {
      // Array of fields, return array of all matching field objects
      return this.fields.filter(field => fields.inclues(field))
    } else {
      return false
    }
  }

  _assert(cond, message) {
    if (!cond) {
      throw new Error(message)
    }
  }

  _isListenerAlreadyApplied(action, callback) {
    // Create the listeners object if necessary
    if (!KnackObject.prototype.listeners) {
      KnackObject.prototype.listeners = {
        [this.key]: {
          'create': new Set(),
          'update': new Set(),
          'delete': new Set(),
        }
      }
    }
    // Create a unique id for the view/callback combo. Must be a better way...
    let viewCallback = this.view.key + callback.toString()
    // Is the view already being watched?
    if (!KnackObject.prototype.listeners[this.key][action].has(viewCallback)) {
      KnackObject.prototype.listeners[this.key][action].add(viewCallback)
      return false
      // Has this callback function already been applied?
    } else {
      return true
    }
  }

  async _goFetch(url, init) {
    let response = await fetch(url, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  }
}

KnackObject.prototype.headers = myKnackHeaders
KnackObject.prototype.user = Knack.getUserAttributes()
KnackObject.prototype.knackURL = 'https://api.knackhq.com/v1/'
KnackObject.prototype.errorMsgs = {
  'noHeaders': 'You must set KnackObject.headers in order to use KnackObject',
  'noView': 'You must initialise with a view in order to use onChange methods'
}
