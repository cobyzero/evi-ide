// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const EVI_CTRL_L_ACTION_ID = 'evi.ctrlLAction'

export const EVI_CTRL_K_ACTION_ID = 'evi.ctrlKAction'

export const EVI_ACCEPT_DIFF_ACTION_ID = 'evi.acceptDiff'

export const EVI_REJECT_DIFF_ACTION_ID = 'evi.rejectDiff'

export const EVI_GOTO_NEXT_DIFF_ACTION_ID = 'evi.goToNextDiff'

export const EVI_GOTO_PREV_DIFF_ACTION_ID = 'evi.goToPrevDiff'

export const EVI_GOTO_NEXT_URI_ACTION_ID = 'evi.goToNextUri'

export const EVI_GOTO_PREV_URI_ACTION_ID = 'evi.goToPrevUri'

export const EVI_ACCEPT_FILE_ACTION_ID = 'evi.acceptFile'

export const EVI_REJECT_FILE_ACTION_ID = 'evi.rejectFile'

export const EVI_ACCEPT_ALL_DIFFS_ACTION_ID = 'evi.acceptAllDiffs'

export const EVI_REJECT_ALL_DIFFS_ACTION_ID = 'evi.rejectAllDiffs'
