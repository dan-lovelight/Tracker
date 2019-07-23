$(document).on('knack-view-render.any', function(event, view, data) {
  try {
    let opportunity
    let user = Knack.getUserAttributes()

    if (view.source) {
      if (view.source.object) {
        if (view.source.object === 'object_17') {
          opportunity = new KnackObject(view.source.object, view)
          opportunity.onChange(globalOpportunityChange)
        }
      }
    }

    function globalOpportunityChange(view, record, action, fields, recordBefore, changes) {
      let data = {}
      let isStatusUpdated = changes.includes('field_127')
      let isQuoteStatusUpdated = changes.includes('field_1606')

      // Record the status change date
      if (isStatusUpdated) {
        data.field_1609 = {
          "date": moment().format("DD/MM/YYYY"),
        }
      }
      // Record the date the quoted status changed (eg Open/Pending)
      if (isQuoteStatusUpdated) {
        data.field_1610 = {
          "date": moment().format("DD/MM/YYYY"),
        }
      }
      // Update the record if a change has taken place
      if (isQuoteStatusUpdated || isStatusUpdated) {
        opportunity.update(record.id, data)
      }
    }

  } catch (error) {
    updateLog(`Opportunity error: \`\`\`${error.message}\n${error.stack}\`\`\``)
  }
})
