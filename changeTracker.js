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
// All three of these functions return the following object
// params = {
//   view: view the triggered the update,
//   record: record after the update,
//   action: {
//   description: 'Create', 'Update' or 'Delete',
//   isCreate: true,
//   isUpdate: false,
//   isDelete: false
// }
//   fields: array of the objects field names,
//   previous: record before the change,
//   changes: array of changed fields (excluding _raw)
// }
// On create returns an empty array of changes and an empty object for previous

class KnackObject {
  constructor(objectKey, view) {
    this.key = objectKey
    this.view = view

    // Load headers required to use Knack API
    if (!this.headers) {
      try {
        KnackObject.prototype.headers = window.myKnackHeaders
      } catch (err) {
        this._assert(this.headers, this.errorMsgs.noHeaders)
      }
    }

    let objectDetails = Knack.objects.models.filter(object => object.id === objectKey)[0]
    this.name = objectDetails.attributes.name
    this.nameSingular = objectDetails.attributes.inflections.singular
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

    id = id || ''
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

    let url = this.knackURL + 'objects/' + this.key + '/records?rows_per_page=' + recordPerPage +
      '&filters=' + filtersEnc + "&sort_field=" + sortFieldEnc + "&sort_order=" +
      sortOrderEnc

    let init = {
      method: 'GET',
      headers: this.headers
    }

    let json = await this._goFetch(url, init)
    let records = await json.records
    return records

  }

  onChange(callback) {
    this.onCreate(callback)
    this.onUpdate(callback)
    this.onDelete(callback)
  }

  onCreate(callback) {

    if (!this._isValidView) return
    this._assert(this.headers, this.errorMsgs.noHeaders)
    this._assert(this.view, this.errorMsgs.noView)

    let self = this
    if (this.view.action && this.view.action !== 'insert') return
    if (this._isListenerAlreadyApplied('create', callback)) return

    // Listen for new records
    $(document).on(`knack-record-create.${this.view.key}`, function(event, view, record) {
      let params = {
        view: view,
        record: record,
        action: {
          description: 'Create',
          isCreate: true,
          isUpdate: false,
          isDelete: false
        },
        fields: self.fields,
        previous: {},
        changes: []
      }
      callback(params)
    })

  }

  async onUpdate(callback) {

    if (!this._isValidView) return
    this._assert(this.headers, this.errorMsgs.noHeaders)
    this._assert(this.view, this.errorMsgs.noView)

    let self = this
    let hash = this._hashCode(`${self.view.key}${callback.toString()}`)
    KnackObject.prototype.recordBefore[self.view.key] = {}

    // Handle update forms
    if (this.view.type === 'form' && this.view.action === 'update') {
      KnackObject.prototype.recordBefore[hash] = await this.get(this.view.scene.scene_id)
      // Only add global listeners once
      if (!this._isListenerAlreadyApplied('update', callback)) {
        $(document).on(`knack-record-update.${this.view.key}`, recordUpdateHandler)
        return // No action links on forms, exit here
      }
    }

    // Handle tables that allow inline edits
    if (this.view.type === 'table' && this.view.options) {
      if (this.view.options.cell_editor) {
        // Get the data in the table
        let dataInTable = Knack.views[this.view.key].model.data.models
        // Check if this is a search view. Data is stored differently if it is
        if (this.view.filter_type) {
          if (this.view.filter_type === 'search') {
            // Get the search results instead
            dataInTable = Knack.views[this.view.key].model.results_model.data.models
          }
        }
        // Store the table data prior to any change being made
        KnackObject.prototype.dataBefore[hash] = JSON.parse(JSON.stringify(dataInTable))
        // Add a listner to the table for inline edits, but only once per view
        if (!this._isListenerAlreadyApplied('update', callback)) {
          $(document).on(`knack-cell-update.${this.view.key}`, cellUpdateHandler)
        }
      }
    }

    function recordUpdateHandler(event, view, record) {
      compareAndReturn(record, KnackObject.prototype.recordBefore[hash])
      // Reset the baseline
      KnackObject.prototype.recordBefore[hash] = JSON.parse(JSON.stringify(record))
    }

    function cellUpdateHandler(event, view, record) {
      // Identify the original record
      KnackObject.prototype.recordBefore[hash] = KnackObject.prototype.dataBefore[hash].filter(recordInTable => recordInTable.id === record.id)[0]

      // Build a complete previous record
      Object.keys(record).forEach(key => {
        if (KnackObject.prototype.recordBefore[hash][key] === undefined) KnackObject.prototype.recordBefore[hash][key] = record[key]
      })

      compareAndReturn(record, KnackObject.prototype.recordBefore[hash])
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
      // Collect all the listeners attached to the action links
      let clickListeners = []
      $actionLinks.each(function() {
        clickListeners.push($._data($(this)[0]).events.click[0])
      })
      // Detatch the click event
      $actionLinks.off('click')
      // Replace the click event with our own
      $actionLinks.click(async function(event) {
        Knack.showSpinner()
        let recordId = self.view.type === 'table' ? $(event.currentTarget).closest('tr').attr('id') : $actionLinks[0].baseURI.split('/').slice(-2).reverse().pop()
        // Execute before function
        let recordBefore = await self.get(recordId)
        // Get the listener for the link that was clicked
        let clickListener = clickListeners[$actionLinks.index($(event.currentTarget))]
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
      if (changes.length > 0) {
        let params = {
          view: self.view,
          record: record,
          action: {
            description: 'Update',
            isCreate: false,
            isUpdate: true,
            isDelete: false
          },
          fields: self.fields,
          previous: recordBefore,
          changes: changes
        }
        callback(params)
      }
    }

  }

  async onDelete(callback) {

    if (!this._isValidView) return
    this._assert(this.headers, this.errorMsgs.noHeaders)
    this._assert(this.view, this.errorMsgs.noView)

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
          let params = {
            view: self.view,
            record: record,
            action: {
              description: 'Delete',
              isCreate: false,
              isUpdate: false,
              isDelete: true
            },
            fields: self.fields,
            previous: {},
            changes: []
          }
          callback(params)
        } else {
          console.log('had to wait')
          setTimeout(waitForRecord, 250);
        }
      }
    }
  }

  static objects(objectKey) {
    let objectsModel = Knack.objects.models
    let requestedObjects = objectsModel.reduce((objects, object) => {
      // if no key is provided, return everything
      if (objectKey === undefined || objectKey === object.attributes.key) {
        objects.push({
          'name': object.attributes.name,
          'key': object.attributes.key,
        })
      }
      return objects
    }, [])

    return requestedObjects
  }

  _assert(cond, message) {
    if (!cond) {
      throw new Error(message)
    }
  }

  _hashCode(string) {
    var hash = 0,
      i, chr;
    if (string.length === 0) return hash;
    for (i = 0; i < string.length; i++) {
      chr = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
  // for each callback function, important to only apply the listener once
  // this checks via a record kept on the KnackObject prototype
  _isListenerAlreadyApplied(action, callback) {
    // Create a unique id for the view/callback combo.
    let alreadyApplied = true
    let hash = this._hashCode(`${this.view.key}${callback.toString()}`)

    if (!KnackObject.prototype.listeners) {
      KnackObject.prototype.listeners = {}
      alreadyApplied = false
    }

    if (!KnackObject.prototype.listeners[this.view.key]) {
      KnackObject.prototype.listeners[this.view.key] = {
        'create': new Set(),
        'update': new Set(),
        'delete': new Set(),
      }
      alreadyApplied = false
    }

    if (!KnackObject.prototype.listeners[this.view.key][action].has(hash)) {
      KnackObject.prototype.listeners[this.view.key][action].add(hash)
      alreadyApplied = false
    }

    return alreadyApplied
  }

  async _goFetch(url, init) {
    let response = await fetch(url, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  }
}

KnackObject.prototype.dataBefore = {}
KnackObject.prototype.recordBefore = {}
KnackObject.prototype.knackURL = 'https://api.knackhq.com/v1/'
KnackObject.prototype.errorMsgs = {
  'noHeaders': 'You must set KnackObject.headers in order to use KnackObject',
  'noView': 'You must initialise with a view in order to use onChange methods'
}
