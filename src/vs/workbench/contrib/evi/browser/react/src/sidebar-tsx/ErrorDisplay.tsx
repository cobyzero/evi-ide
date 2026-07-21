/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSettingsState } from '../util/services.js';
import { errorDetails } from '../../../../common/sendLLMMessageTypes.js';


export const ErrorDisplay = ({
	message: message_,
	fullError,
	onDismiss,
	showDismiss,
}: {
	message: string,
	fullError: Error | null,
	onDismiss: (() => void) | null,
	showDismiss?: boolean,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const details = errorDetails(fullError)
	const isExpandable = !!details

	const message = message_ + ''

	return (
		<div className={`rounded-xl border border-evi-warning/30 bg-evi-bg-2 p-3 overflow-auto`}>
			{/* Header */}
			<div className='flex items-start justify-between'>
				<div className='flex gap-2.5'>
					<AlertCircle className='h-4 w-4 text-evi-warning mt-0.5 flex-shrink-0' />
					<div className='flex-1 min-w-0'>
						<p className='text-evi-fg-1 text-sm font-medium'>
							{message}
						</p>
					</div>
				</div>

				<div className='flex gap-1 ml-2 flex-shrink-0'>
					{isExpandable && (
						<button className='text-evi-fg-4 hover:text-evi-fg-2 p-1 rounded-lg evi-transition'
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<ChevronUp className='h-3.5 w-3.5' />
							) : (
								<ChevronDown className='h-3.5 w-3.5' />
							)}
						</button>
					)}
					{showDismiss && onDismiss && (
						<button className='text-evi-fg-4 hover:text-evi-fg-2 p-1 rounded-lg evi-transition'
							onClick={onDismiss}
						>
							<X className='h-3.5 w-3.5' />
						</button>
					)}
				</div>
			</div>

			{/* Expandable Details */}
			{isExpanded && details && (
				<div className='mt-2 space-y-2 border-t border-evi-border-3 pt-2 overflow-auto'>
					<div>
						<span className='font-medium text-evi-fg-3 text-xs'>Full Error: </span>
						<pre className='text-evi-fg-4 text-xs mt-1'>{details}</pre>
					</div>
				</div>
			)}
		</div>
	);
};
