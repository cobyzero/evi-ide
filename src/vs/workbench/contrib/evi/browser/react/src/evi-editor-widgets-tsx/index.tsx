/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { EviCommandBarMain } from './EviCommandBar.js'
import { EviSelectionHelperMain } from './EviSelectionHelper.js'

export const mountEviCommandBar = mountFnGenerator(EviCommandBarMain)

export const mountEviSelectionHelper = mountFnGenerator(EviSelectionHelperMain)

