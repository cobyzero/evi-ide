/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { ButtonHTMLAttributes, FormEvent, FormHTMLAttributes, Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';


import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState, useActiveURI, useCommandBarState, useFullChatThreadsStreamState } from '../util/services.js';
import { ScrollType } from '../../../../../../../editor/common/editorCommon.js';

import { ChatMarkdownRender, ChatMessageLocation, getApplyBoxId } from '../markdown/ChatMarkdownRender.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { IDisposable } from '../../../../../../../base/common/lifecycle.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import { BlockCode, TextAreaFns, EviCustomDropdownBox, EviInputBox2, EviSlider, EviSwitch, EviDiffEditor } from '../util/inputs.js';
import { ModelDropdown, } from '../evi-settings-tsx/ModelDropdown.js';
import { PastThreadsList } from './SidebarThreadSelector.js';
import { EVI_CTRL_L_ACTION_ID } from '../../../actionIDs.js';
import { EVI_OPEN_SETTINGS_ACTION_ID } from '../../../eviSettingsPane.js';
import { ChatMode, displayInfoOfProviderName, FeatureName, isFeatureNameDisabled } from '../../../../../../../workbench/contrib/evi/common/eviSettingsTypes.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { WarningBox } from '../evi-settings-tsx/WarningBox.js';
import { getModelCapabilities, getIsReasoningEnabledState } from '../../../../common/modelCapabilities.js';
import { AlertTriangle, File, Ban, Check, ChevronRight, Dot, FileIcon, Pencil, Undo, Undo2, X, Flag, Copy as CopyIcon, Info, CirclePlus, Ellipsis, CircleEllipsis, Folder, ALargeSmall, TypeOutline, Text, Brain } from 'lucide-react';
import { ChatMessage, CheckpointEntry, StagingSelectionItem, ToolMessage } from '../../../../common/chatThreadServiceTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, ToolName, LintErrorItem, ToolApprovalType, toolApprovalTypes } from '../../../../common/toolsServiceTypes.js';
import { CopyButton, EditToolAcceptRejectButtonsHTML, IconShell1, JumpToFileButton, JumpToTerminalButton, StatusIndicator, StatusIndicatorForApplyButton, useApplyStreamState, useEditToolStreamState } from '../markdown/ApplyBlockHoverButtons.js';
import { IsRunningType } from '../../../chatThreadService.js';
import { acceptAllBg, acceptBorder, buttonFontSize, buttonTextColor, rejectAllBg, rejectBg, rejectBorder } from '../../../../common/helpers/colors.js';
import { builtinToolNames, isABuiltinToolName, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_INACTIVE_TIME } from '../../../../common/prompt/prompts.js';
import { RawToolCallObj } from '../../../../common/sendLLMMessageTypes.js';
import ErrorBoundary from './ErrorBoundary.js';
import { ToolApprovalTypeSwitch } from '../evi-settings-tsx/Settings.js';

import { persistentTerminalNameOfId } from '../../../terminalToolService.js';
import { removeMCPToolNamePrefix } from '../../../../common/mcpServiceTypes.js';



export const IconX = ({ size, className = '', ...props }: { size: number, className?: string } & React.SVGProps<SVGSVGElement>) => {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			className={className}
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M6 18 18 6M6 6l12 12'
			/>
		</svg>
	);
};

const IconArrowUp = ({ size, className = '', style }: { size: number, className?: string, style?: React.CSSProperties }) => {
	return (
		<svg
			width={size}
			height={size}
			className={className}
			style={style}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
			></path>
		</svg>
	);
};


const IconSquare = ({ size, className = '', style }: { size: number, className?: string, style?: React.CSSProperties }) => {
	return (
		<svg
			className={className}
			style={style}
			stroke="currentColor"
			fill="currentColor"
			strokeWidth="0"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
		</svg>
	);
};


export const IconWarning = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			stroke="currentColor"
			fill="currentColor"
			strokeWidth="0"
			viewBox="0 0 16 16"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z"
			/>
		</svg>
	);
};


export const IconLoading = ({ className = '' }: { className?: string }) => {

	const [loadingText, setLoadingText] = useState('.');

	useEffect(() => {
		let intervalId;

		const toggleLoadingText = () => {
			if (loadingText === '...') {
				setLoadingText('.');
			} else {
				setLoadingText(loadingText + '.');
			}
		};

		intervalId = setInterval(toggleLoadingText, 400);

		return () => clearInterval(intervalId);
	}, [loadingText, setLoadingText]);

	return <span className={`inline-block min-w-[16px] text-left ${className}`}>{loadingText}</span>;

}



// SLIDER ONLY:
const ReasoningOptionSlider = ({ featureName }: { featureName: FeatureName }) => {
	const accessor = useAccessor()

	const eviSettingsService = accessor.get('IEviSettingsService')
	const eviSettingsState = useSettingsState()

	const modelSelection = eviSettingsState.modelSelectionOfFeature[featureName]
	const overridesOfModel = eviSettingsState.overridesOfModel

	if (!modelSelection) return null

	const { modelName, providerName } = modelSelection
	const { reasoningCapabilities } = getModelCapabilities(providerName, modelName, overridesOfModel)
	const { canTurnOffReasoning, reasoningSlider: reasoningBudgetSlider } = reasoningCapabilities || {}

	const modelSelectionOptions = eviSettingsState.optionsOfModelSelection[featureName][providerName]?.[modelName]
	const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)

	if (canTurnOffReasoning && !reasoningBudgetSlider) {
		return <div className='flex items-center gap-x-2 px-1'>
			<span className='text-evi-fg-4 text-[11px] font-medium pointer-events-none whitespace-nowrap'>Thinking</span>
			<EviSwitch
				size='xxs'
				value={isReasoningEnabled}
				onChange={(newVal) => {
					const isOff = canTurnOffReasoning && !newVal
					eviSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff })
				}}
			/>
		</div>
	}

	if (reasoningBudgetSlider?.type === 'budget_slider') {
		const { min: min_, max, default: defaultVal } = reasoningBudgetSlider

		const nSteps = 8
		const stepSize = Math.round((max - min_) / nSteps)

		const valueIfOff = min_ - stepSize
		const min = canTurnOffReasoning ? valueIfOff : min_
		const value = isReasoningEnabled ? eviSettingsState.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]?.reasoningBudget ?? defaultVal
			: valueIfOff

		return <div className='flex items-center gap-x-2 px-1'>
			<span className='text-evi-fg-4 text-[11px] font-medium pointer-events-none whitespace-nowrap'>Thinking</span>
			<EviSlider
				width={50}
				size='xs'
				min={min}
				max={max}
				step={stepSize}
				value={value}
				onChange={(newVal) => {
					const isOff = canTurnOffReasoning && newVal === valueIfOff
					eviSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff, reasoningBudget: newVal })
				}}
			/>
			<span className='text-evi-fg-4 text-[11px] pointer-events-none whitespace-nowrap'>{isReasoningEnabled ? `${value}` : 'Off'}</span>
		</div>
	}

	if (reasoningBudgetSlider?.type === 'effort_slider') {

		const { values, default: defaultVal } = reasoningBudgetSlider

		const min = canTurnOffReasoning ? -1 : 0
		const max = values.length - 1

		const currentEffort = eviSettingsState.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]?.reasoningEffort ?? defaultVal
		const valueIfOff = -1
		const value = isReasoningEnabled && currentEffort ? values.indexOf(currentEffort) : valueIfOff

		const currentEffortCapitalized = currentEffort.charAt(0).toUpperCase() + currentEffort.slice(1, Infinity)

		return <div className='flex items-center gap-x-2 px-1'>
			<span className='text-evi-fg-4 text-[11px] font-medium pointer-events-none whitespace-nowrap'>Thinking</span>
			<EviSlider
				width={30}
				size='xs'
				min={min}
				max={max}
				step={1}
				value={value}
				onChange={(newVal) => {
					const isOff = canTurnOffReasoning && newVal === valueIfOff
					eviSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff, reasoningEffort: values[newVal] ?? undefined })
				}}
			/>
			<span className='text-evi-fg-4 text-[11px] pointer-events-none whitespace-nowrap'>{isReasoningEnabled ? currentEffortCapitalized : 'Off'}</span>
		</div>
	}

	return null
}



const nameOfChatMode = {
	'normal': 'Chat',
	'gather': 'Gather',
	'agent': 'Agent',
}

const detailOfChatMode = {
	'normal': 'Ask questions, get answers',
	'gather': 'Read files, gather context',
	'agent': 'Edit files, run commands, use tools',
}

const modeAccentColor = {
	'normal': 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
	'gather': 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
	'agent': 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
}

const modeIconOnly = (mode: ChatMode) => {
	switch (mode) {
		case 'agent': return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M9 14h6" /></svg>
		case 'gather': return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
		default: return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
	}
}


const ChatModeDropdown = ({ className }: { className: string }) => {
	const accessor = useAccessor()

	const eviSettingsService = accessor.get('IEviSettingsService')
	const settingsState = useSettingsState()

	const activeModel = settingsState.modelSelectionOfFeature['Chat']
	const isAgentSupported = useMemo(() => {
		if (!activeModel) return false
		const caps = getModelCapabilities(activeModel.providerName, activeModel.modelName, settingsState.overridesOfModel)
		return !!caps.specialToolFormat
	}, [activeModel, settingsState.overridesOfModel])

	const options: ChatMode[] = useMemo(() => {
		const base: ChatMode[] = ['normal', 'gather']
		if (isAgentSupported) base.push('agent')
		return base
	}, [isAgentSupported])

	const onChangeOption = useCallback((newVal: ChatMode) => {
		eviSettingsService.setGlobalSetting('chatMode', newVal)
	}, [eviSettingsService])

	// Fall back to 'normal' if current mode not in options
	const selectedOption: ChatMode = options.includes(settingsState.globalSettings.chatMode)
		? settingsState.globalSettings.chatMode
		: 'normal'

	const modeIcon = (mode: ChatMode) => {
		return <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r ${modeAccentColor[mode]}`}>
			{modeIconOnly(mode)}
			<span>{nameOfChatMode[mode]}</span>
		</span>
	}

	const modeIconSmall = (mode: ChatMode) => {
		return <span className={`inline-flex items-center gap-1.5`}>
			{modeIconOnly(mode)}
			<span className="text-xs font-medium">{nameOfChatMode[mode]}</span>
		</span>
	}

	return <EviCustomDropdownBox
		className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1 px-1.5 cursor-pointer select-none bg-evi-bg-2 border border-evi-border-3 hover:border-evi-border-2 hover:bg-evi-bg-2-hover evi-hover-fade transition-all duration-200 ${className}`}
		options={options}
		selectedOption={selectedOption}
		onChangeOption={onChangeOption}
		getOptionDisplayName={(val) => modeIconSmall(val)}
		getOptionDropdownName={(val) => nameOfChatMode[val]}
		getOptionDropdownDetail={(val) => detailOfChatMode[val]}
		getOptionsEqual={(a, b) => a === b}
	/>

}





interface EviChatAreaProps {
	// Required
	children: React.ReactNode; // This will be the input component

	// Form controls
	onSubmit: () => void;
	onAbort: () => void;
	isStreaming: boolean;
	isDisabled?: boolean;
	divRef?: React.RefObject<HTMLDivElement | null>;

	// UI customization
	className?: string;
	showModelDropdown?: boolean;
	showSelections?: boolean;
	showProspectiveSelections?: boolean;
	loadingIcon?: React.ReactNode;

	selections?: StagingSelectionItem[]
	setSelections?: (s: StagingSelectionItem[]) => void
	// selections?: any[];
	// onSelectionsChange?: (selections: any[]) => void;

	onClickAnywhere?: () => void;
	// Optional close button
	onClose?: () => void;

	featureName: FeatureName;
}

export const VoidChatArea: React.FC<EviChatAreaProps> = ({
	children,
	onSubmit,
	onAbort,
	onClose,
	onClickAnywhere,
	divRef,
	isStreaming = false,
	isDisabled = false,
	className = '',
	showModelDropdown = true,
	showSelections = false,
	showProspectiveSelections = false,
	selections,
	setSelections,
	featureName,
	loadingIcon,
}) => {
	return (
		<div
			ref={divRef}
			className={`
				gap-x-1
                flex flex-col p-3 relative input text-left shrink-0
                rounded-2xl
                bg-evi-bg-1
				transition-all duration-200
				border border-evi-border-3
				focus-within:border-[var(--evi-ring-color)] focus-within:shadow-[0_0_0_2px_color-mix(in srgb,var(--evi-ring-color)_20%,transparent_80%)]
				hover:border-evi-border-2
				max-h-[80vh] overflow-y-auto
                ${className}
            `}
			onClick={(e) => {
				onClickAnywhere?.()
			}}
		>
			{/* Selections section */}
			{showSelections && selections && setSelections && (
				<SelectedFiles
					type='staging'
					selections={selections}
					setSelections={setSelections}
					showProspectiveSelections={showProspectiveSelections}
				/>
			)}

			{/* Input section */}
			<div className="relative w-full">
				{children}

				{/* Close button (X) if onClose is provided */}
				{onClose && (
					<div className='absolute -top-1.5 -right-1.5 cursor-pointer z-1'>
						<IconX
							size={14}
							className="stroke-[2] opacity-60 text-evi-fg-3 hover:opacity-100 hover:brightness-95 evi-transition"
							onClick={onClose}
						/>
					</div>
				)}
			</div>

			{/* Bottom row */}
			<div className='flex flex-row justify-between items-center gap-1.5 mt-2'>
				{showModelDropdown && (
					<div className='flex flex-col gap-y-1.5'>
						<ReasoningOptionSlider featureName={featureName} />

						<div className='flex items-center flex-wrap gap-x-1.5 gap-y-1 text-nowrap'>
							{featureName === 'Chat' && <ChatModeDropdown />}
							<ModelDropdown featureName={featureName} className='inline-flex items-center gap-1 text-xs font-medium text-evi-fg-3 bg-evi-bg-2 rounded-lg py-1 px-2 evi-hover-fade hover:bg-evi-bg-2-hover cursor-pointer select-none' />
						</div>
					</div>
				)}

				<div className="flex items-center gap-2 ml-auto">

					{isStreaming && loadingIcon}

					{isStreaming ? (
						<ButtonStop onClick={onAbort} />
					) : (
						<ButtonSubmit
							onClick={onSubmit}
							disabled={isDisabled}
						/>
					)}
				</div>

			</div>
		</div>
	);
};




type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>
const DEFAULT_BUTTON_SIZE = 22;
export const ButtonSubmit = ({ className, disabled, ...props }: ButtonProps & Required<Pick<ButtonProps, 'disabled'>>) => {

	return <button
		type='button'
		className={`rounded-full flex-shrink-0 flex-grow-0 flex items-center justify-center
			transition-all duration-150 shadow-sm text-white
			${disabled ? 'bg-evi-bg-2 cursor-default opacity-50' : 'bg-[var(--vscode-button-background)] hover:brightness-110 cursor-pointer active:scale-95'}
			${className}
		`}
		{...props}
	>
		<IconArrowUp size={DEFAULT_BUTTON_SIZE} className="stroke-[2] p-[2px]" />
	</button>
}

export const ButtonStop = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => {
	return <button
		className={`rounded-full flex-shrink-0 flex-grow-0 cursor-pointer flex items-center justify-center
			transition-all duration-150 shadow-sm text-white
			bg-[var(--vscode-button-background)] hover:brightness-110 active:scale-95
			${className}
		`}
		type='button'
		{...props}
	>
		<IconSquare size={DEFAULT_BUTTON_SIZE} className="stroke-[3] p-[7px]" />
	</button>
}



const scrollToBottom = (divRef: { current: HTMLElement | null }) => {
	if (divRef.current) {
		divRef.current.scrollTop = divRef.current.scrollHeight;
	}
};



const ScrollToBottomContainer = ({ children, className, style, scrollContainerRef }: { children: React.ReactNode, className?: string, style?: React.CSSProperties, scrollContainerRef: React.MutableRefObject<HTMLDivElement | null> }) => {
	const [isAtBottom, setIsAtBottom] = useState(true); // Start at bottom

	const divRef = scrollContainerRef

	const onScroll = () => {
		const div = divRef.current;
		if (!div) return;

		const isBottom = Math.abs(
			div.scrollHeight - div.clientHeight - div.scrollTop
		) < 4;

		setIsAtBottom(isBottom);
	};

	// When children change (new messages added)
	useEffect(() => {
		if (isAtBottom) {
			scrollToBottom(divRef);
		}
	}, [children, isAtBottom]); // Dependency on children to detect new messages

	// Initial scroll to bottom
	useEffect(() => {
		scrollToBottom(divRef);
	}, []);

	return (
		<div
			ref={divRef}
			onScroll={onScroll}
			className={className}
			style={style}
		>
			{children}
		</div>
	);
};

export const getRelative = (uri: URI, accessor: ReturnType<typeof useAccessor>) => {
	const workspaceContextService = accessor.get('IWorkspaceContextService')
	let path: string
	const isInside = workspaceContextService.isInsideWorkspace(uri)
	if (isInside) {
		const f = workspaceContextService.getWorkspace().folders.find(f => uri.fsPath?.startsWith(f.uri.fsPath))
		if (f) { path = uri.fsPath.replace(f.uri.fsPath, '') }
		else { path = uri.fsPath }
	}
	else {
		path = uri.fsPath
	}
	return path || undefined
}

export const getFolderName = (pathStr: string) => {
	// 'unixify' path
	pathStr = pathStr.replace(/[/\\]+/g, '/') // replace any / or \ or \\ with /
	const parts = pathStr.split('/') // split on /
	// Filter out empty parts (the last element will be empty if path ends with /)
	const nonEmptyParts = parts.filter(part => part.length > 0)
	if (nonEmptyParts.length === 0) return '/' // Root directory
	if (nonEmptyParts.length === 1) return nonEmptyParts[0] + '/' // Only one folder
	// Get the last two parts
	const lastTwo = nonEmptyParts.slice(-2)
	return lastTwo.join('/') + '/'
}

export const getBasename = (pathStr: string, parts: number = 1) => {
	// 'unixify' path
	pathStr = pathStr.replace(/[/\\]+/g, '/') // replace any / or \ or \\ with /
	const allParts = pathStr.split('/') // split on /
	if (allParts.length === 0) return pathStr
	return allParts.slice(-parts).join('/')
}



// Open file utility function
export const eviOpenFileFn = (
	uri: URI,
	accessor: ReturnType<typeof useAccessor>,
	range?: [number, number]
) => {
	const commandService = accessor.get('ICommandService')
	const editorService = accessor.get('ICodeEditorService')

	// Get editor selection from CodeSelection range
	let editorSelection = undefined;

	// If we have a selection, create an editor selection from the range
	if (range) {
		editorSelection = {
			startLineNumber: range[0],
			startColumn: 1,
			endLineNumber: range[1],
			endColumn: Number.MAX_SAFE_INTEGER,
		};
	}

	// open the file
	commandService.executeCommand('vscode.open', uri).then(() => {

		// select the text
		setTimeout(() => {
			if (!editorSelection) return;

			const editor = editorService.getActiveCodeEditor()
			if (!editor) return;

			editor.setSelection(editorSelection)
			editor.revealRange(editorSelection, ScrollType.Immediate)

		}, 50) // needed when document was just opened and needs to initialize

	})

};


export const SelectedFiles = (
	{ type, selections, setSelections, showProspectiveSelections, messageIdx, }:
		| { type: 'past', selections: StagingSelectionItem[]; setSelections?: undefined, showProspectiveSelections?: undefined, messageIdx: number, }
		| { type: 'staging', selections: StagingSelectionItem[]; setSelections: ((newSelections: StagingSelectionItem[]) => void), showProspectiveSelections?: boolean, messageIdx?: number }
) => {

	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const modelReferenceService = accessor.get('IEviModelService')




	// state for tracking prospective files
	const { uri: currentURI } = useActiveURI()
	const [recentUris, setRecentUris] = useState<URI[]>([])
	const maxRecentUris = 10
	const maxProspectiveFiles = 3
	useEffect(() => { // handle recent files
		if (!currentURI) return
		setRecentUris(prev => {
			const withoutCurrent = prev.filter(uri => uri.fsPath !== currentURI.fsPath) // remove duplicates
			const withCurrent = [currentURI, ...withoutCurrent]
			return withCurrent.slice(0, maxRecentUris)
		})
	}, [currentURI])
	const [prospectiveSelections, setProspectiveSelections] = useState<StagingSelectionItem[]>([])


	// handle prospective files
	useEffect(() => {
		const computeRecents = async () => {
			const prospectiveURIs = recentUris
				.filter(uri => !selections.find(s => s.type === 'File' && s.uri.fsPath === uri.fsPath))
				.slice(0, maxProspectiveFiles)

			const answer: StagingSelectionItem[] = []
			for (const uri of prospectiveURIs) {
				answer.push({
					type: 'File',
					uri: uri,
					language: (await modelReferenceService.getModelSafe(uri)).model?.getLanguageId() || 'plaintext',
					state: { wasAddedAsCurrentFile: false },
				})
			}
			return answer
		}

		// add a prospective file if type === 'staging' and if the user is in a file, and if the file is not selected yet
		if (type === 'staging' && showProspectiveSelections) {
			computeRecents().then((a) => setProspectiveSelections(a))
		}
		else {
			setProspectiveSelections([])
		}
	}, [recentUris, selections, type, showProspectiveSelections])


	const allSelections = [...selections, ...prospectiveSelections]

	if (allSelections.length === 0) {
		return null
	}

	return (
		<div className='flex items-center flex-wrap text-left relative gap-x-0.5 gap-y-1 pb-0.5'>

			{allSelections.map((selection, i) => {

				const isThisSelectionProspective = i > selections.length - 1

				const thisKey = selection.type === 'CodeSelection' ? selection.type + selection.language + selection.range + selection.state.wasAddedAsCurrentFile + selection.uri.fsPath
					: selection.type === 'File' ? selection.type + selection.language + selection.state.wasAddedAsCurrentFile + selection.uri.fsPath
						: selection.type === 'Folder' ? selection.type + selection.language + selection.state + selection.uri.fsPath
							: i

				const SelectionIcon = (
					selection.type === 'File' ? File
						: selection.type === 'Folder' ? Folder
							: selection.type === 'CodeSelection' ? Text
								: (undefined as never)
				)

				return <div // container for summarybox and code
					key={thisKey}
					className={`flex flex-col space-y-[1px]`}
				>
					{/* tooltip for file path */}
					<span className="truncate overflow-hidden text-ellipsis"
						data-tooltip-id='evi-tooltip'
						data-tooltip-content={getRelative(selection.uri, accessor)}
						data-tooltip-place='top'
						data-tooltip-delay-show={3000}
					>
						{/* summarybox */}
						<div
							className={`
								flex items-center gap-1 relative
								px-1.5 py-0.5
								w-fit h-fit
								select-none
								text-xs text-nowrap
								border rounded-lg
								${isThisSelectionProspective ? 'bg-evi-bg-1 text-evi-fg-3 opacity-60' : 'bg-evi-bg-2 hover:bg-evi-bg-2-hover text-evi-fg-1'}
								${isThisSelectionProspective
									? 'border-evi-border-3'
									: 'border-evi-border-3 hover:border-evi-border-2'
								}
								evi-transition
							`}
							onClick={() => {
								if (type !== 'staging') return; // (never)
								if (isThisSelectionProspective) { // add prospective selection to selections
									setSelections([...selections, selection])
								}
								else if (selection.type === 'File') { // open files
									eviOpenFileFn(selection.uri, accessor);

									const wasAddedAsCurrentFile = selection.state.wasAddedAsCurrentFile
									if (wasAddedAsCurrentFile) {
										// make it so the file is added permanently, not just as the current file
										const newSelection: StagingSelectionItem = { ...selection, state: { ...selection.state, wasAddedAsCurrentFile: false } }
										setSelections([
											...selections.slice(0, i),
											newSelection,
											...selections.slice(i + 1)
										])
									}
								}
								else if (selection.type === 'CodeSelection') {
									eviOpenFileFn(selection.uri, accessor, selection.range);
								}
								else if (selection.type === 'Folder') {
									// TODO!!! reveal in tree
								}
							}}
						>
							{<SelectionIcon size={10} />}

							{ // file name and range
								getBasename(selection.uri.fsPath)
								+ (selection.type === 'CodeSelection' ? ` (${selection.range[0]}-${selection.range[1]})` : '')
							}

							{selection.type === 'File' && selection.state.wasAddedAsCurrentFile && messageIdx === undefined && currentURI?.fsPath === selection.uri.fsPath ?
								<span className={`text-[8px] 'evi-opacity-60 text-evi-fg-4`}>
									{`(Current File)`}
								</span>
								: null
							}

							{type === 'staging' && !isThisSelectionProspective ? // X button
								<div // box for making it easier to click
									className='cursor-pointer z-1 self-stretch flex items-center justify-center'
									onClick={(e) => {
										e.stopPropagation(); // don't open/close selection
										if (type !== 'staging') return;
										setSelections([...selections.slice(0, i), ...selections.slice(i + 1)])
									}}
								>
									<IconX
										className='stroke-[2]'
										size={10}
									/>
								</div>
								: <></>
							}
						</div>
					</span>
				</div>

			})}


		</div>

	)
}


type ToolHeaderParams = {
	icon?: React.ReactNode;
	title: React.ReactNode;
	desc1: React.ReactNode;
	desc1OnClick?: () => void;
	desc2?: React.ReactNode;
	isError?: boolean;
	info?: string;
	desc1Info?: string;
	isRejected?: boolean;
	numResults?: number;
	hasNextPage?: boolean;
	children?: React.ReactNode;
	bottomChildren?: React.ReactNode;
	onClick?: () => void;
	desc2OnClick?: () => void;
	isOpen?: boolean;
	className?: string;
}

const ToolHeaderWrapper = ({
	icon,
	title,
	desc1,
	desc1OnClick,
	desc1Info,
	desc2,
	numResults,
	hasNextPage,
	children,
	info,
	bottomChildren,
	isError,
	onClick,
	desc2OnClick,
	isOpen,
	isRejected,
	className, // applies to the main content
}: ToolHeaderParams) => {

	const [isOpen_, setIsOpen] = useState(false);
	const isExpanded = isOpen !== undefined ? isOpen : isOpen_

	const isDropdown = children !== undefined // null ALLOWS dropdown
	const isClickable = !!(isDropdown || onClick)

	const isDesc1Clickable = !!desc1OnClick

	const desc1HTML = <span
		className={`text-evi-fg-4 text-xs italic truncate ml-2
			${isDesc1Clickable ? 'cursor-pointer hover:brightness-125 transition-all duration-150' : ''}
		`}
		onClick={desc1OnClick}
		{...desc1Info ? {
			'data-tooltip-id': 'evi-tooltip',
			'data-tooltip-content': desc1Info,
			'data-tooltip-place': 'top',
			'data-tooltip-delay-show': 1000,
		} : {}}
	>{desc1}</span>

	return (<div className='evi-hover-fade'>
		<div className={`w-full evi-tool-card rounded-xl overflow-hidden px-2.5 py-2 ${className}`}>
			{/* header */}
			<div className={`select-none flex items-center min-h-[22px]`}>
				<div className={`flex items-center w-full gap-x-2 overflow-hidden justify-between ${isRejected ? 'line-through opacity-60' : ''}`}>
					{/* left */}
					<div // container for if desc1 is clickable
						className='flex items-center overflow-hidden min-w-0'
					>
						{/* title eg "> Edited File" */}
						<div className={`
							flex items-center min-w-0 overflow-hidden grow gap-1
							${isClickable ? 'cursor-pointer evi-transition hover:opacity-80' : ''}
						`}
							onClick={() => {
								if (isDropdown) { setIsOpen(v => !v); }
								if (onClick) { onClick(); }
							}}
						>
							{isDropdown && (<ChevronRight
								className={`
								text-evi-fg-3 mr-0.5 h-3.5 w-3.5 flex-shrink-0 transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)]
								${isExpanded ? 'rotate-90' : ''}
							`}
							/>)}
							<span className="text-evi-fg-3 text-xs font-medium flex-shrink-0">{title}</span>

							{!isDesc1Clickable && desc1HTML}
						</div>
						{isDesc1Clickable && desc1HTML}
					</div>

					{/* right */}
					<div className="flex items-center gap-x-1.5 flex-shrink-0">

						{info && <CircleEllipsis
							className='text-evi-fg-4 opacity-50 flex-shrink-0'
							size={13}
							data-tooltip-id='evi-tooltip'
							data-tooltip-content={info}
							data-tooltip-place='top-end'
						/>}

						{isError && <AlertTriangle
							className='text-evi-warning flex-shrink-0'
							size={13}
							data-tooltip-id='evi-tooltip'
							data-tooltip-content={'Error running tool'}
							data-tooltip-place='top'
						/>}
						{isRejected && <Ban
							className='text-evi-fg-4 opacity-70 flex-shrink-0'
							size={13}
							data-tooltip-id='evi-tooltip'
							data-tooltip-content={'Canceled'}
							data-tooltip-place='top'
						/>}
						{desc2 && <span className="text-evi-fg-4 text-xs" onClick={desc2OnClick}>
							{desc2}
						</span>}
						{numResults !== undefined && (
							<span className="text-evi-fg-4 text-[10px] ml-auto mr-0.5">
								{`${numResults}${hasNextPage ? '+' : ''} result${numResults !== 1 ? 's' : ''}`}
							</span>
						)}
					</div>
				</div>
			</div>
			{/* children */}
			{<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}
					text-evi-fg-4 rounded-lg overflow-x-auto
				  `}
			>
				{children}
			</div>}
		</div>
		{bottomChildren}
	</div>);
};



const EditTool = ({ toolMessage, threadId, messageIdx, content }: Parameters<ResultWrapper<'edit_file' | 'rewrite_file'>>[0] & { content: string }) => {
	const accessor = useAccessor()
	const isError = false
	const isRejected = toolMessage.type === 'rejected'

	const title = getTitle(toolMessage)

	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
	const icon = null

	const { rawParams, params, name } = toolMessage
	const desc1OnClick = () => eviOpenFileFn(params.uri, accessor)
	const componentParams: ToolHeaderParams = { title, desc1, desc1OnClick, desc1Info, isError, icon, isRejected, }


	const editToolType = toolMessage.name === 'edit_file' ? 'diff' : 'rewrite'
	if (toolMessage.type === 'running_now' || toolMessage.type === 'tool_request') {
		componentParams.children = <ToolChildrenWrapper className='bg-evi-bg-3'>
			<EditToolChildren
				uri={params.uri}
				code={content}
				type={editToolType}
			/>
		</ToolChildrenWrapper>
		// JumpToFileButton removed in favor of FileLinkText
	}
	else if (toolMessage.type === 'success' || toolMessage.type === 'rejected' || toolMessage.type === 'tool_error') {
		// add apply box
		const applyBoxId = getApplyBoxId({
			threadId: threadId,
			messageIdx: messageIdx,
			tokenIdx: 'N/A',
		})
		componentParams.desc2 = <EditToolHeaderButtons
			applyBoxId={applyBoxId}
			uri={params.uri}
			codeStr={content}
			toolName={name}
			threadId={threadId}
		/>

		// add children
		componentParams.children = <ToolChildrenWrapper className='bg-evi-bg-3'>
			<EditToolChildren
				uri={params.uri}
				code={content}
				type={editToolType}
			/>
		</ToolChildrenWrapper>

		if (toolMessage.type === 'success' || toolMessage.type === 'rejected') {
			const { result } = toolMessage
			componentParams.bottomChildren = <BottomChildren title='Lint errors'>
				{result?.lintErrors?.map((error, i) => (
					<div key={i} className='whitespace-nowrap'>Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}</div>
				))}
			</BottomChildren>
		}
		else if (toolMessage.type === 'tool_error') {
			// error
			const { result } = toolMessage
			componentParams.bottomChildren = <BottomChildren title='Error'>
				<CodeChildren>
					{result}
				</CodeChildren>
			</BottomChildren>
		}
	}

	return <ToolHeaderWrapper {...componentParams} />
}

const SimplifiedToolHeader = ({
	title,
	children,
}: {
	title: string;
	children?: React.ReactNode;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const isDropdown = children !== undefined;
	return (
		<div className='w-full'>
			<div
				className={`select-none flex items-center min-h-[22px] evi-tool-card rounded-lg px-2 py-1 text-xs ${isDropdown ? 'cursor-pointer' : ''}`}
				onClick={() => {
					if (isDropdown) { setIsOpen(v => !v); }
				}}
			>
				{isDropdown && (
					<ChevronRight
						className={`mr-0.5 h-3 w-3 flex-shrink-0 transition-transform duration-100 text-evi-fg-4 ${isOpen ? 'rotate-90' : ''}`}
					/>
				)}
				<div className="flex items-center w-full overflow-hidden">
					<span className="text-evi-fg-3 font-medium">{title}</span>
				</div>
			</div>
			{<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'} text-evi-fg-4`}
			>
				{children}
			</div>}
		</div>
	);
};




const UserMessageComponent = ({ chatMessage, messageIdx, isCheckpointGhost, currCheckpointIdx, _scrollToBottom }: { chatMessage: ChatMessage & { role: 'user' }, messageIdx: number, currCheckpointIdx: number | undefined, isCheckpointGhost: boolean, _scrollToBottom: (() => void) | null }) => {

	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')

	// global state
	let isBeingEdited = false
	let stagingSelections: StagingSelectionItem[] = []
	let setIsBeingEdited = (_: boolean) => { }
	let setStagingSelections = (_: StagingSelectionItem[]) => { }

	if (messageIdx !== undefined) {
		const _state = chatThreadsService.getCurrentMessageState(messageIdx)
		isBeingEdited = _state.isBeingEdited
		stagingSelections = _state.stagingSelections
		setIsBeingEdited = (v) => chatThreadsService.setCurrentMessageState(messageIdx, { isBeingEdited: v })
		setStagingSelections = (s) => chatThreadsService.setCurrentMessageState(messageIdx, { stagingSelections: s })
	}


	// local state
	const mode: ChatBubbleMode = isBeingEdited ? 'edit' : 'display'
	const [isFocused, setIsFocused] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const [isDisabled, setIsDisabled] = useState(false)
	const [textAreaRefState, setTextAreaRef] = useState<HTMLTextAreaElement | null>(null)
	const textAreaFnsRef = useRef<TextAreaFns | null>(null)
	// initialize on first render, and when edit was just enabled
	const _mustInitialize = useRef(true)
	const _justEnabledEdit = useRef(false)
	useEffect(() => {
		const canInitialize = mode === 'edit' && textAreaRefState
		const shouldInitialize = _justEnabledEdit.current || _mustInitialize.current
		if (canInitialize && shouldInitialize) {
			setStagingSelections(
				(chatMessage.selections || []).map(s => { // quick hack so we dont have to do anything more
					if (s.type === 'File') return { ...s, state: { ...s.state, wasAddedAsCurrentFile: false, } }
					else return s
				})
			)

			if (textAreaFnsRef.current)
				textAreaFnsRef.current.setValue(chatMessage.displayContent || '')

			textAreaRefState.focus();

			_justEnabledEdit.current = false
			_mustInitialize.current = false
		}

	}, [chatMessage, mode, _justEnabledEdit, textAreaRefState, textAreaFnsRef.current, _justEnabledEdit.current, _mustInitialize.current])

	const onOpenEdit = () => {
		setIsBeingEdited(true)
		chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx)
		_justEnabledEdit.current = true
	}
	const onCloseEdit = () => {
		setIsFocused(false)
		setIsHovered(false)
		setIsBeingEdited(false)
		chatThreadsService.setCurrentlyFocusedMessageIdx(undefined)

	}

	const EditSymbol = mode === 'display' ? Pencil : X


	let chatbubbleContents: React.ReactNode
	if (mode === 'display') {
		chatbubbleContents = <>
			<SelectedFiles type='past' messageIdx={messageIdx} selections={chatMessage.selections || []} />
			<span className='px-0.5'>{chatMessage.displayContent}</span>
		</>
	}
	else if (mode === 'edit') {

		const onSubmit = async () => {

			if (isDisabled) return;
			if (!textAreaRefState) return;
			if (messageIdx === undefined) return;

			// cancel any streams on this thread
			const threadId = chatThreadsService.state.currentThreadId

			await chatThreadsService.abortRunning(threadId)

			// update state
			setIsBeingEdited(false)
			chatThreadsService.setCurrentlyFocusedMessageIdx(undefined)

			// stream the edit
			const userMessage = textAreaRefState.value;
			try {
				await chatThreadsService.editUserMessageAndStreamResponse({ userMessage, messageIdx, threadId })
			} catch (e) {
				console.error('Error while editing message:', e)
			}
			await chatThreadsService.focusCurrentChat()
			requestAnimationFrame(() => _scrollToBottom?.())
		}

		const onAbort = async () => {
			const threadId = chatThreadsService.state.currentThreadId
			await chatThreadsService.abortRunning(threadId)
		}

		const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Escape') {
				onCloseEdit()
			}
			if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
				onSubmit()
			}
		}

		if (!chatMessage.content) { // don't show if empty and not loading (if loading, want to show).
			return null
		}

		chatbubbleContents = <VoidChatArea
			featureName='Chat'
			onSubmit={onSubmit}
			onAbort={onAbort}
			isStreaming={false}
			isDisabled={isDisabled}
			showSelections={true}
			showProspectiveSelections={false}
			selections={stagingSelections}
			setSelections={setStagingSelections}
		>
			<EviInputBox2
				enableAtToMention
				ref={setTextAreaRef}
				className='min-h-[81px] max-h-[500px] px-0.5'
				placeholder="Edit your message..."
				onChangeText={(text) => setIsDisabled(!text)}
				onFocus={() => {
					setIsFocused(true)
					chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
				}}
				onBlur={() => {
					setIsFocused(false)
				}}
				onKeyDown={onKeyDown}
				fnsRef={textAreaFnsRef}
				multiline={true}
			/>
		</VoidChatArea>
	}

	const isMsgAfterCheckpoint = currCheckpointIdx !== undefined && currCheckpointIdx === messageIdx - 1

	const UserAvatar = (
		<div className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-xl bg-[var(--vscode-button-background)] flex items-center justify-center select-none shadow-sm">
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</div>
	)

	return <div
		className={`
			flex items-end gap-2 justify-end
			${mode === 'edit' ? 'w-full' : ''}
			${isCheckpointGhost && !isMsgAfterCheckpoint ? 'opacity-50 pointer-events-none' : ''}
			evi-message-in
		`}
		onMouseEnter={() => setIsHovered(true)}
		onMouseLeave={() => setIsHovered(false)}
	>
		{mode === 'display' && (
			<div className="flex flex-col items-end gap-1.5 max-w-[88%]">
				<div
					className={`
						text-left rounded-2xl rounded-br-md max-w-full
						p-3 flex flex-col evi-user-bubble text-evi-fg-1 overflow-x-auto cursor-pointer evi-hover-fade
					`}
					onClick={() => { onOpenEdit() }}
				>
					{chatbubbleContents}
				</div>
				<div
					className={`
						cursor-pointer
						p-1 rounded-lg
						transition-opacity duration-200 ease-in-out evi-hover-fade
						${isHovered || isFocused ? 'opacity-100' : 'opacity-0'}
					`}
					onClick={() => { onOpenEdit() }}
				>
					<EditSymbol size={14} className="text-evi-fg-4 hover:text-evi-fg-2" />
				</div>
			</div>
		)}
		{mode === 'display' && UserAvatar}
		{mode === 'edit' && (
			<div className="w-full max-w-full">
				{chatbubbleContents}
			</div>
		)}
	</div>

}

const SmallProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div className='
text-evi-fg-4
prose
prose-sm
break-words
max-w-none
leading-relaxed
text-[13px]

[&>:first-child]:!mt-0
[&>:last-child]:!mb-0

prose-h1:text-[14px]
prose-h1:my-4
prose-h1:font-semibold

prose-h2:text-[13px]
prose-h2:my-4
prose-h2:font-semibold

prose-h3:text-[13px]
prose-h3:my-3
prose-h3:font-semibold

prose-h4:text-[13px]
prose-h4:my-2
prose-h4:font-semibold

prose-p:my-1.5
prose-p:leading-relaxed
prose-hr:my-2

prose-ul:my-1.5
prose-ul:pl-4
prose-ul:list-outside
prose-ul:list-disc
prose-ul:leading-relaxed

prose-ol:my-1.5
prose-ol:pl-4
prose-ol:list-outside
prose-ol:list-decimal
prose-ol:leading-relaxed

marker:text-inherit

prose-blockquote:border-l-2
prose-blockquote:border-[var(--evi-border-2)]
prose-blockquote:pl-3
prose-blockquote:my-2
prose-blockquote:text-evi-fg-4
prose-blockquote:italic

prose-code:text-evi-fg-2
prose-code:text-[12px]
prose-code:before:content-none
prose-code:after:content-none
prose-code:bg-[var(--evi-bg-2)]
prose-code:px-1
prose-code:py-0.5
prose-code:rounded

prose-pre:bg-[var(--evi-bg-2)]
prose-pre:text-[12px]
prose-pre:p-2.5
prose-pre:my-2
prose-pre:rounded-lg
prose-pre:border
prose-pre:border-[var(--evi-border-3)]

prose-table:text-[13px]
'>
		{children}
	</div>
}

const ProseWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div className='
text-evi-fg-2
prose
prose-sm
break-words
prose-p:block
prose-hr:my-3
prose-pre:my-2
marker:text-inherit
prose-ol:list-outside
prose-ol:list-decimal
prose-ul:list-outside
prose-ul:list-disc
prose-li:my-0.5
prose-code:before:content-none
prose-code:after:content-none
prose-code:bg-[var(--evi-bg-2)]
prose-code:px-1
prose-code:py-0.5
prose-code:rounded
prose-code:text-evi-fg-2
prose-pre:bg-[var(--evi-bg-2)]
prose-pre:rounded-lg
prose-pre:border
prose-pre:border-[var(--evi-border-3)]
prose-pre:p-2.5
prose-headings:prose-sm
prose-headings:font-semibold
prose-p:leading-relaxed
prose-ol:leading-relaxed
prose-ul:leading-relaxed
prose-blockquote:border-l-2
prose-blockquote:border-[var(--evi-border-2)]
prose-blockquote:pl-3
prose-blockquote:my-2
prose-blockquote:text-evi-fg-4
prose-blockquote:italic
prose-table:text-[13px]

max-w-none
'
	>
		{children}
	</div>
}
const AssistantMessageComponent = ({ chatMessage, isCheckpointGhost, isCommitted, messageIdx }: { chatMessage: ChatMessage & { role: 'assistant' }, isCheckpointGhost: boolean, messageIdx: number, isCommitted: boolean }) => {

	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')

	const reasoningStr = chatMessage.reasoning?.trim() || null
	const hasReasoning = !!reasoningStr
	const isDoneReasoning = !!chatMessage.displayContent
	const thread = chatThreadsService.getCurrentThread()


	const chatMessageLocation: ChatMessageLocation = {
		threadId: thread.id,
		messageIdx: messageIdx,
	}

	const isEmpty = !chatMessage.displayContent && !chatMessage.reasoning
	if (isEmpty) return null

	const BotAvatar = (
		<div className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-xl bg-gradient-to-br from-[var(--evi-ring-color)] to-[color-mix(in srgb,var(--evi-ring-color)_60%,transparent_40%)] flex items-center justify-center select-none shadow-sm">
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="11" width="18" height="10" rx="2" />
				<circle cx="12" cy="5" r="2" />
				<path d="M9 14h6" />
				<path d="M12 14v3" />
			</svg>
		</div>
	)

	return <div className={`flex items-start gap-2.5 ${isCheckpointGhost ? 'opacity-50' : ''} evi-message-in`}>
		{BotAvatar}
		<div className="flex flex-col gap-2 min-w-0 flex-1 max-w-[88%]">
			{/* reasoning token */}
			{hasReasoning &&
				<div>
					<ReasoningWrapper isDoneReasoning={isDoneReasoning} isStreaming={!isCommitted}>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={reasoningStr}
								chatMessageLocation={chatMessageLocation}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ReasoningWrapper>
				</div>
			}

			{/* assistant message */}
			{chatMessage.displayContent &&
				<div className="evi-assistant-bubble rounded-2xl rounded-bl-md p-3.5 evi-hover-fade">
					<ProseWrapper>
						<ChatMarkdownRender
							string={chatMessage.displayContent || ''}
							chatMessageLocation={chatMessageLocation}
							isApplyEnabled={true}
							isLinkDetectionEnabled={true}
						/>
					</ProseWrapper>
				</div>
			}
		</div>
	</div>

}

const ReasoningWrapper = ({ isDoneReasoning, isStreaming, children }: { isDoneReasoning: boolean, isStreaming: boolean, children: React.ReactNode }) => {
	const isDone = isDoneReasoning || !isStreaming
	const isWriting = !isDone
	const [isOpen, setIsOpen] = useState(isWriting)
	useEffect(() => {
		if (!isWriting) setIsOpen(false)
	}, [isWriting])
	return <div className="evi-tool-card rounded-xl overflow-hidden evi-hover-fade">
		<div
			className={`flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none text-xs ${isWriting ? 'evi-reasoning-pulse' : ''}`}
			onClick={() => setIsOpen(v => !v)}
		>
			<div className="flex-shrink-0 w-4 h-4 rounded bg-[var(--evi-bg-2-alt)] flex items-center justify-center">
				<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-evi-fg-3">
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4" />
					<path d="M12 8h.01" />
				</svg>
			</div>
			<ChevronRight
				className={`h-3 w-3 flex-shrink-0 transition-transform duration-100 text-evi-fg-4 ${isOpen ? 'rotate-90' : ''}`}
			/>
			<span className="text-evi-fg-3 font-semibold tracking-wide uppercase text-[11px]">Thinking</span>
			{isWriting && <span className="text-evi-fg-4 text-[11px] ml-auto">thinking...</span>}
		</div>
		<div
			className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 p-2.5' : 'max-h-0 opacity-0'}`}
		>
			<div className='!select-text cursor-auto border-l-2 border-[var(--evi-ring-color)]/30 pl-2.5'>
				{children}
			</div>
		</div>
	</div>
}




// should either be past or "-ing" tense, not present tense. Eg. when the LLM searches for something, the user expects it to say "I searched for X" or "I am searching for X". Not "I search X".

const loadingTitleWrapper = (item: React.ReactNode): React.ReactNode => {
	return <span className='flex items-center flex-nowrap gap-0.5'>
		{item}
		<IconLoading className='text-xs opacity-70' />
	</span>
}

const titleOfBuiltinToolName = {
	'read_file': { done: 'Read file', proposed: 'Read file', running: loadingTitleWrapper('Reading file') },
	'ls_dir': { done: 'Inspected folder', proposed: 'Inspect folder', running: loadingTitleWrapper('Inspecting folder') },
	'get_dir_tree': { done: 'Inspected folder tree', proposed: 'Inspect folder tree', running: loadingTitleWrapper('Inspecting folder tree') },
	'search_pathnames_only': { done: 'Searched by file name', proposed: 'Search by file name', running: loadingTitleWrapper('Searching by file name') },
	'search_for_files': { done: 'Searched', proposed: 'Search', running: loadingTitleWrapper('Searching') },
	'create_file_or_folder': { done: `Created`, proposed: `Create`, running: loadingTitleWrapper(`Creating`) },
	'delete_file_or_folder': { done: `Deleted`, proposed: `Delete`, running: loadingTitleWrapper(`Deleting`) },
	'edit_file': { done: `Edited file`, proposed: 'Edit file', running: loadingTitleWrapper('Editing file') },
	'rewrite_file': { done: `Wrote file`, proposed: 'Write file', running: loadingTitleWrapper('Writing file') },
	'run_command': { done: `Ran terminal`, proposed: 'Run terminal', running: loadingTitleWrapper('Running terminal') },
	'run_persistent_command': { done: `Ran terminal`, proposed: 'Run terminal', running: loadingTitleWrapper('Running terminal') },

	'open_persistent_terminal': { done: `Opened terminal`, proposed: 'Open terminal', running: loadingTitleWrapper('Opening terminal') },
	'kill_persistent_terminal': { done: `Killed terminal`, proposed: 'Kill terminal', running: loadingTitleWrapper('Killing terminal') },

	'read_lint_errors': { done: `Read lint errors`, proposed: 'Read lint errors', running: loadingTitleWrapper('Reading lint errors') },
	'search_in_file': { done: 'Searched in file', proposed: 'Search in file', running: loadingTitleWrapper('Searching in file') },
} as const satisfies Record<BuiltinToolName, { done: any, proposed: any, running: any }>


const getTitle = (toolMessage: Pick<ChatMessage & { role: 'tool' }, 'name' | 'type' | 'mcpServerName'>): React.ReactNode => {
	const t = toolMessage

	// non-built-in title
	if (!builtinToolNames.includes(t.name as BuiltinToolName)) {
		// descriptor of Running or Ran etc
		const descriptor =
			t.type === 'success' ? 'Called'
				: t.type === 'running_now' ? 'Calling'
					: t.type === 'tool_request' ? 'Call'
						: t.type === 'rejected' ? 'Call'
							: t.type === 'invalid_params' ? 'Call'
								: t.type === 'tool_error' ? 'Call'
									: 'Call'


		const title = `${descriptor} ${toolMessage.mcpServerName || 'MCP'}`
		if (t.type === 'running_now' || t.type === 'tool_request')
			return loadingTitleWrapper(title)
		return title
	}

	// built-in title
	else {
		const toolName = t.name as BuiltinToolName
		if (t.type === 'success') return titleOfBuiltinToolName[toolName].done
		if (t.type === 'running_now') return titleOfBuiltinToolName[toolName].running
		return titleOfBuiltinToolName[toolName].proposed
	}
}


const toolNameToDesc = (toolName: BuiltinToolName, _toolParams: BuiltinToolCallParams[BuiltinToolName] | undefined, accessor: ReturnType<typeof useAccessor>): {
	desc1: React.ReactNode,
	desc1Info?: string,
} => {

	if (!_toolParams) {
		return { desc1: '', };
	}

	const x = {
		'read_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['read_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'ls_dir': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['ls_dir']
			return {
				desc1: getFolderName(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'search_pathnames_only': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_pathnames_only']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'search_for_files': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_for_files']
			return {
				desc1: `"${toolParams.query}"`,
			}
		},
		'search_in_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['search_in_file'];
			return {
				desc1: `"${toolParams.query}"`,
				desc1Info: getRelative(toolParams.uri, accessor),
			};
		},
		'create_file_or_folder': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['create_file_or_folder']
			return {
				desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? '/' : getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'delete_file_or_folder': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['delete_file_or_folder']
			return {
				desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? '/' : getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'rewrite_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['rewrite_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'edit_file': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['edit_file']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'run_command': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['run_command']
			return {
				desc1: `"${toolParams.command}"`,
			}
		},
		'run_persistent_command': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['run_persistent_command']
			return {
				desc1: `"${toolParams.command}"`,
			}
		},
		'open_persistent_terminal': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['open_persistent_terminal']
			return { desc1: '' }
		},
		'kill_persistent_terminal': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['kill_persistent_terminal']
			return { desc1: toolParams.persistentTerminalId }
		},
		'get_dir_tree': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['get_dir_tree']
			return {
				desc1: getFolderName(toolParams.uri.fsPath) ?? '/',
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		},
		'read_lint_errors': () => {
			const toolParams = _toolParams as BuiltinToolCallParams['read_lint_errors']
			return {
				desc1: getBasename(toolParams.uri.fsPath),
				desc1Info: getRelative(toolParams.uri, accessor),
			}
		}
	}

	try {
		return x[toolName]?.() || { desc1: '' }
	}
	catch {
		return { desc1: '' }
	}
}

const ToolRequestAcceptRejectButtons = ({ toolName }: { toolName: ToolName }) => {
	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const metricsService = accessor.get('IMetricsService')
	const eviSettingsService = accessor.get('IEviSettingsService')
	const eviSettingsState = useSettingsState()

	const onAccept = useCallback(() => {
		try { // this doesn't need to be wrapped in try/catch anymore
			const threadId = chatThreadsService.state.currentThreadId
			chatThreadsService.approveLatestToolRequest(threadId)
			metricsService.capture('Tool Request Accepted', {})
		} catch (e) { console.error('Error while approving message in chat:', e) }
	}, [chatThreadsService, metricsService])

	const onReject = useCallback(() => {
		try {
			const threadId = chatThreadsService.state.currentThreadId
			chatThreadsService.rejectLatestToolRequest(threadId)
		} catch (e) { console.error('Error while approving message in chat:', e) }
		metricsService.capture('Tool Request Rejected', {})
	}, [chatThreadsService, metricsService])

	const approveButton = (
		<button
			onClick={onAccept}
			className={`
				inline-flex items-center gap-1.5 px-3 py-1.5
				bg-[var(--vscode-button-background)]
				text-[var(--vscode-button-foreground)]
				hover:brightness-110
				rounded-lg
				text-xs font-semibold
				evi-transition active:scale-95
				shadow-sm
			`}
		>
			<Check size={12} strokeWidth={2.5} />
			Approve
		</button>
	)

	const cancelButton = (
		<button
			onClick={onReject}
			className={`
				inline-flex items-center gap-1.5 px-3 py-1.5
				bg-[var(--vscode-button-secondaryBackground)]
				text-[var(--vscode-button-secondaryForeground)]
				hover:brightness-110
				rounded-lg
				text-xs font-semibold
				evi-transition active:scale-95
			`}
		>
			<X size={12} strokeWidth={2.5} />
			Reject
		</button>
	)

	const approvalType = isABuiltinToolName(toolName) ? approvalTypeOfBuiltinToolName[toolName] : 'MCP tools'
	const approvalToggle = approvalType ? <div key={approvalType} className="flex items-center ml-2 gap-x-1">
		<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
	</div> : null

	return <div className="flex gap-1.5 mx-0.5 items-center">
		{approveButton}
		{cancelButton}
		{approvalToggle}
	</div>
}

export const ToolChildrenWrapper = ({ children, className }: { children: React.ReactNode, className?: string }) => {
	return <div className={`${className ? className : ''} cursor-default select-none`}>
		<div className='min-w-full overflow-hidden'>
			{children}
		</div>
	</div>
}
export const CodeChildren = ({ children, className }: { children: React.ReactNode, className?: string }) => {
	return <div className={`${className ?? ''} p-2 rounded-lg overflow-auto text-sm bg-evi-bg-3`}>
		<div className='!select-text cursor-auto'>
			{children}
		</div>
	</div>
}

export const ListableToolItem = ({ name, onClick, isSmall, className, showDot }: { name: React.ReactNode, onClick?: () => void, isSmall?: boolean, className?: string, showDot?: boolean }) => {
	return <div
		className={`
			${onClick ? 'hover:opacity-80 cursor-pointer evi-transition' : ''}
			flex items-center flex-nowrap whitespace-nowrap
			${className ? className : ''}
			`}
		onClick={onClick}
	>
		{showDot === false ? null : <div className="flex-shrink-0"><svg className="w-1 h-1 opacity-50 mr-1.5 fill-current" viewBox="0 0 100 40"><rect x="0" y="15" width="100" height="10" /></svg></div>}
		<div className={`${isSmall ? 'italic text-evi-fg-4 flex items-center' : 'text-evi-fg-3'}`}>{name}</div>
	</div>
}



const EditToolChildren = ({ uri, code, type }: { uri: URI | undefined, code: string, type: 'diff' | 'rewrite' }) => {

	const content = type === 'diff' ?
		<EviDiffEditor uri={uri} searchReplaceBlocks={code} />
		: <ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />

	return <div className='!select-text cursor-auto'>
		<SmallProseWrapper>
			{content}
		</SmallProseWrapper>
	</div>

}


const LintErrorChildren = ({ lintErrors }: { lintErrors: LintErrorItem[] }) => {
	return <div className="text-xs text-evi-fg-4 border-l-2 border-evi-warning/50 pl-2.5 py-1 flex flex-col gap-1 overflow-x-auto">
		{lintErrors.map((error, i) => (
			<div key={i} className="opacity-80">Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}</div>
		))}
	</div>
}

const BottomChildren = ({ children, title }: { children: React.ReactNode, title: string }) => {
	const [isOpen, setIsOpen] = useState(false);
	if (!children) return null;
	return (
		<div className="w-full px-2.5 mt-1">
			<div
				className={`flex items-center cursor-pointer select-none evi-transition py-0.5 rounded group`}
				onClick={() => setIsOpen(o => !o)}
			>
				<ChevronRight
					className={`mr-1 h-3 w-3 flex-shrink-0 transition-transform duration-100 text-evi-fg-4 group-hover:text-evi-fg-3 ${isOpen ? 'rotate-90' : ''}`}
				/>
				<span className="font-medium text-evi-fg-4 group-hover:text-evi-fg-3 text-xs">{title}</span>
			</div>
			<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'opacity-100' : 'max-h-0 opacity-0'} text-xs`}
			>
				<div className="overflow-x-auto text-evi-fg-4 border-l-2 border-evi-warning/50 pl-2.5 py-0.5">
					{children}
				</div>
			</div>
		</div>
	);
}


const EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, toolName, threadId }: { threadId: string, applyBoxId: string, uri: URI, codeStr: string, toolName: 'edit_file' | 'rewrite_file' }) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri })
	return <div className='flex items-center gap-0.5'>
		{streamState === 'idle-no-changes' && <CopyButton codeStr={codeStr} toolTipName='Copy' />}
		<EditToolAcceptRejectButtonsHTML type={toolName} codeStr={codeStr} applyBoxId={applyBoxId} uri={uri} threadId={threadId} />
	</div>
}



const InvalidTool = ({ toolName, message, mcpServerName }: { toolName: ToolName, message: string, mcpServerName: string | undefined }) => {
	const accessor = useAccessor()
	const title = getTitle({ name: toolName, type: 'invalid_params', mcpServerName })
	const desc1 = 'Invalid parameters'
	const icon = null
	const isError = true
	const componentParams: ToolHeaderParams = { title, desc1, isError, icon }

	componentParams.children = <ToolChildrenWrapper>
		<CodeChildren className='bg-evi-bg-3'>
			{message}
		</CodeChildren>
	</ToolChildrenWrapper>
	return <ToolHeaderWrapper {...componentParams} />
}

const CanceledTool = ({ toolName, mcpServerName }: { toolName: ToolName, mcpServerName: string | undefined }) => {
	const accessor = useAccessor()
	const title = getTitle({ name: toolName, type: 'rejected', mcpServerName })
	const desc1 = ''
	const icon = null
	const isRejected = true
	const componentParams: ToolHeaderParams = { title, desc1, icon, isRejected }
	return <ToolHeaderWrapper {...componentParams} />
}


const CommandTool = ({ toolMessage, type, threadId }: { threadId: string } & ({
	toolMessage: Exclude<ToolMessage<'run_command'>, { type: 'invalid_params' }>
	type: 'run_command'
} | {
	toolMessage: Exclude<ToolMessage<'run_persistent_command'>, { type: 'invalid_params' }>
	type: | 'run_persistent_command'
})) => {
	const accessor = useAccessor()

	const commandService = accessor.get('ICommandService')
	const terminalToolsService = accessor.get('ITerminalToolService')
	const toolsService = accessor.get('IToolsService')
	const isError = false
	const title = getTitle(toolMessage)
	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
	const icon = null
	const streamState = useChatThreadsStreamState(threadId)

	const divRef = useRef<HTMLDivElement | null>(null)

	const isRejected = toolMessage.type === 'rejected'
	const { rawParams, params } = toolMessage
	const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }


	const effect = async () => {
		if (streamState?.isRunning !== 'tool') return
		if (type !== 'run_command' || toolMessage.type !== 'running_now') return;

		// wait for the interruptor so we know it's running

		await streamState?.interrupt
		const container = divRef.current;
		if (!container) return;

		const terminal = terminalToolsService.getTemporaryTerminal(toolMessage.params.terminalId);
		if (!terminal) return;

		try {
			terminal.attachToElement(container);
			terminal.setVisible(true)
		} catch {
		}

		// Listen for size changes of the container and keep the terminal layout in sync.
		const resizeObserver = new ResizeObserver((entries) => {
			const height = entries[0].borderBoxSize[0].blockSize;
			const width = entries[0].borderBoxSize[0].inlineSize;
			if (typeof terminal.layout === 'function') {
				terminal.layout({ width, height });
			}
		});

		resizeObserver.observe(container);
		return () => { terminal.detachFromElement(); resizeObserver?.disconnect(); }
	}

	useEffect(() => {
		effect()
	}, [terminalToolsService, toolMessage, toolMessage.type, type]);

	if (toolMessage.type === 'success') {
		const { result } = toolMessage

		// it's unclear that this is a button and not an icon.
		// componentParams.desc2 = <JumpToTerminalButton
		// 	onClick={() => { terminalToolsService.openTerminal(terminalId) }}
		// />

		let msg: string
		if (type === 'run_command') msg = toolsService.stringOfResult['run_command'](toolMessage.params, result)
		else msg = toolsService.stringOfResult['run_persistent_command'](toolMessage.params, result)

		if (type === 'run_persistent_command') {
			componentParams.info = persistentTerminalNameOfId(toolMessage.params.persistentTerminalId)
		}

		componentParams.children = <ToolChildrenWrapper className='whitespace-pre text-nowrap overflow-auto text-sm'>
			<div className='!select-text cursor-auto'>
				<BlockCode initValue={`${msg.trim()}`} language='shellscript' />
			</div>
		</ToolChildrenWrapper>
	}
	else if (toolMessage.type === 'tool_error') {
		const { result } = toolMessage
		componentParams.bottomChildren = <BottomChildren title='Error'>
			<CodeChildren>
				{result}
			</CodeChildren>
		</BottomChildren>
	}
	else if (toolMessage.type === 'running_now') {
		if (type === 'run_command')
			componentParams.children = <div ref={divRef} className='relative h-[300px] text-sm' />
	}
	else if (toolMessage.type === 'rejected' || toolMessage.type === 'tool_request') {
	}

	return <>
		<ToolHeaderWrapper {...componentParams} isOpen={type === 'run_command' && toolMessage.type === 'running_now' ? true : undefined} />
	</>
}

type WrapperProps<T extends ToolName> = { toolMessage: Exclude<ToolMessage<T>, { type: 'invalid_params' }>, messageIdx: number, threadId: string }
const MCPToolWrapper = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')

	const title = getTitle(toolMessage)
	const desc1 = removeMCPToolNamePrefix(toolMessage.name)
	const icon = null


	if (toolMessage.type === 'running_now') return null // do not show running

	const isError = false
	const isRejected = toolMessage.type === 'rejected'
	const { rawParams, params } = toolMessage
	const componentParams: ToolHeaderParams = { title, desc1, isError, icon, isRejected, }

	const paramsStr = JSON.stringify(params, null, 2)
	componentParams.desc2 = <CopyButton codeStr={paramsStr} toolTipName={`Copy inputs: ${paramsStr}`} />

	componentParams.info = !toolMessage.mcpServerName ? 'MCP tool not found' : undefined

	// Add copy inputs button in desc2


	if (toolMessage.type === 'success' || toolMessage.type === 'tool_request') {
		const { result } = toolMessage
		const resultStr = result ? mcpService.stringifyResult(result) : 'null'
		componentParams.children = <ToolChildrenWrapper>
			<SmallProseWrapper>
				<ChatMarkdownRender
					string={`\`\`\`json\n${resultStr}\n\`\`\``}
					chatMessageLocation={undefined}
					isApplyEnabled={false}
					isLinkDetectionEnabled={true}
				/>
			</SmallProseWrapper>
		</ToolChildrenWrapper>
	}
	else if (toolMessage.type === 'tool_error') {
		const { result } = toolMessage
		componentParams.bottomChildren = <BottomChildren title='Error'>
			<CodeChildren>
				{result}
			</CodeChildren>
		</BottomChildren>
	}

	return <ToolHeaderWrapper {...componentParams} />

}

type ResultWrapper<T extends ToolName> = (props: WrapperProps<T>) => React.ReactNode

const builtinToolNameToComponent: { [T in BuiltinToolName]: { resultWrapper: ResultWrapper<T>, } } = {
	'read_file': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			let range: [number, number] | undefined = undefined
			if (toolMessage.params.startLine !== null || toolMessage.params.endLine !== null) {
				const start = toolMessage.params.startLine === null ? `1` : `${toolMessage.params.startLine}`
				const end = toolMessage.params.endLine === null ? `` : `${toolMessage.params.endLine}`
				const addStr = `(${start}-${end})`
				componentParams.desc1 += ` ${addStr}`
				range = [params.startLine || 1, params.endLine || 1]
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor, range) }
				if (result.hasNextPage && params.pageNumber === 1)  // first page
					componentParams.desc2 = `(truncated after ${Math.round(MAX_FILE_CHARS_PAGE) / 1000}k)`
				else if (params.pageNumber > 1) // subsequent pages
					componentParams.desc2 = `(part ${params.pageNumber})`
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'get_dir_tree': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.uri) {
				const rel = getRelative(params.uri, accessor)
				if (rel) componentParams.info = `Only search in ${rel}`
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.children = <ToolChildrenWrapper>
					<SmallProseWrapper>
						<ChatMarkdownRender
							string={`\`\`\`\n${result.str}\n\`\`\``}
							chatMessageLocation={undefined}
							isApplyEnabled={false}
							isLinkDetectionEnabled={true}
						/>
					</SmallProseWrapper>
				</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />

		}
	},
	'ls_dir': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const explorerService = accessor.get('IExplorerService')
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.uri) {
				const rel = getRelative(params.uri, accessor)
				if (rel) componentParams.info = `Only search in ${rel}`
			}

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.numResults = result.children?.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = !result.children || (result.children.length ?? 0) === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.children.map((child, i) => (<ListableToolItem key={i}
							name={`${child.name}${child.isDirectory ? '/' : ''}`}
							className='w-full overflow-auto'
							onClick={() => {
								eviOpenFileFn(child.uri, accessor)
								// commandService.executeCommand('workbench.view.explorer'); // open in explorer folders view instead
								// explorerService.select(child.uri, true);
							}}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={`Results truncated (${result.itemsRemaining} remaining).`} isSmall={true} className='w-full overflow-auto' />
						}
					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'search_pathnames_only': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.includePattern) {
				componentParams.info = `Only search in ${params.includePattern}`
			}

			if (toolMessage.type === 'success') {
				const { result, rawParams } = toolMessage
				componentParams.numResults = result.uris.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = result.uris.length === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.uris.map((uri, i) => (<ListableToolItem key={i}
							name={getBasename(uri.fsPath)}
							className='w-full overflow-auto'
							onClick={() => { eviOpenFileFn(uri, accessor) }}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={'Results truncated.'} isSmall={true} className='w-full overflow-auto' />
						}

					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'search_for_files': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (params.searchInFolder || params.isRegex) {
				let info: string[] = []
				if (params.searchInFolder) {
					const rel = getRelative(params.searchInFolder, accessor)
					if (rel) info.push(`Only search in ${rel}`)
				}
				if (params.isRegex) { info.push(`Uses regex search`) }
				componentParams.info = info.join('; ')
			}

			if (toolMessage.type === 'success') {
				const { result, rawParams } = toolMessage
				componentParams.numResults = result.uris.length
				componentParams.hasNextPage = result.hasNextPage
				componentParams.children = result.uris.length === 0 ? undefined
					: <ToolChildrenWrapper>
						{result.uris.map((uri, i) => (<ListableToolItem key={i}
							name={getBasename(uri.fsPath)}
							className='w-full overflow-auto'
							onClick={() => { eviOpenFileFn(uri, accessor) }}
						/>))}
						{result.hasNextPage &&
							<ListableToolItem name={`Results truncated.`} isSmall={true} className='w-full overflow-auto' />
						}

					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}
			return <ToolHeaderWrapper {...componentParams} />
		}
	},

	'search_in_file': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get('IToolsService');
			const title = getTitle(toolMessage);
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
			const icon = null;

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected };

			const infoarr: string[] = []
			const uriStr = getRelative(params.uri, accessor)
			if (uriStr) infoarr.push(uriStr)
			if (params.isRegex) infoarr.push('Uses regex search')
			componentParams.info = infoarr.join('; ')

			if (toolMessage.type === 'success') {
				const { result } = toolMessage; // result is array of snippets
				componentParams.numResults = result.lines.length;
				componentParams.children = result.lines.length === 0 ? undefined :
					<ToolChildrenWrapper>
						<CodeChildren className='bg-evi-bg-3'>
							<pre className='font-mono whitespace-pre'>
								{toolsService.stringOfResult['search_in_file'](params, result)}
							</pre>
						</CodeChildren>
					</ToolChildrenWrapper>
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage;
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />;
		}
	},

	'read_lint_errors': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')

			const title = getTitle(toolMessage)

			const { uri } = toolMessage.params ?? {}
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			componentParams.info = getRelative(uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
				if (result.lintErrors)
					componentParams.children = <LintErrorChildren lintErrors={result.lintErrors} />
				else
					componentParams.children = `No lint errors found.`

			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},

	// ---

	'create_file_or_folder': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null


			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			componentParams.info = getRelative(params.uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'rejected') {
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				if (params) { componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) } }
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}
			else if (toolMessage.type === 'running_now') {
				// nothing more is needed
			}
			else if (toolMessage.type === 'tool_request') {
				// nothing more is needed
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'delete_file_or_folder': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const isFolder = toolMessage.params?.isFolder ?? false
			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const title = getTitle(toolMessage)
			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const icon = null

			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			componentParams.info = getRelative(params.uri, accessor) // full path

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'rejected') {
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				if (params) { componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) } }
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}
			else if (toolMessage.type === 'running_now') {
				const { result } = toolMessage
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
			}
			else if (toolMessage.type === 'tool_request') {
				const { result } = toolMessage
				componentParams.onClick = () => { eviOpenFileFn(params.uri, accessor) }
			}

			return <ToolHeaderWrapper {...componentParams} />
		}
	},
	'rewrite_file': {
		resultWrapper: (params) => {
			return <EditTool {...params} content={params.toolMessage.params.newContent} />
		}
	},
	'edit_file': {
		resultWrapper: (params) => {
			return <EditTool {...params} content={params.toolMessage.params.searchReplaceBlocks} />
		}
	},

	// ---

	'run_command': {
		resultWrapper: (params) => {
			return <CommandTool {...params} type='run_command' />
		}
	},

	'run_persistent_command': {
		resultWrapper: (params) => {
			return <CommandTool {...params} type='run_persistent_command' />
		}
	},
	'open_persistent_terminal': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const terminalToolsService = accessor.get('ITerminalToolService')

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const title = getTitle(toolMessage)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			const relativePath = params.cwd ? getRelative(URI.file(params.cwd), accessor) : ''
			componentParams.info = relativePath ? `Running in ${relativePath}` : undefined

			if (toolMessage.type === 'success') {
				const { result } = toolMessage
				const { persistentTerminalId } = result
				componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId)
				componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId)
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
	'kill_persistent_terminal': {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor()
			const commandService = accessor.get('ICommandService')
			const terminalToolsService = accessor.get('ITerminalToolService')

			const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
			const title = getTitle(toolMessage)
			const icon = null

			if (toolMessage.type === 'tool_request') return null // do not show past requests
			if (toolMessage.type === 'running_now') return null // do not show running

			const isError = false
			const isRejected = toolMessage.type === 'rejected'
			const { rawParams, params } = toolMessage
			const componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected, }

			if (toolMessage.type === 'success') {
				const { persistentTerminalId } = params
				componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId)
				componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId)
			}
			else if (toolMessage.type === 'tool_error') {
				const { result } = toolMessage
				componentParams.bottomChildren = <BottomChildren title='Error'>
					<CodeChildren>
						{result}
					</CodeChildren>
				</BottomChildren>
			}

			return <ToolHeaderWrapper {...componentParams} />
		},
	},
};


const Checkpoint = ({ message, threadId, messageIdx, isCheckpointGhost, threadIsRunning }: { message: CheckpointEntry, threadId: string; messageIdx: number, isCheckpointGhost: boolean, threadIsRunning: boolean }) => {
	const accessor = useAccessor()
	const chatThreadService = accessor.get('IChatThreadService')
	const streamState = useFullChatThreadsStreamState()

	const isRunning = useChatThreadsStreamState(threadId)?.isRunning
	const isDisabled = useMemo(() => {
		if (isRunning) return true
		return !!Object.keys(streamState).find((threadId2) => streamState[threadId2]?.isRunning)
	}, [isRunning, streamState])

	return <div
		className="flex items-center justify-center px-2 py-1"
	>
		<div
			className={`
				text-[10px] font-medium uppercase tracking-wider
				text-evi-fg-4
				select-none
				px-2 py-0.5 rounded-full
				${isCheckpointGhost ? 'opacity-30' : 'opacity-60 hover:opacity-90'}
				${isDisabled ? 'cursor-default' : 'cursor-pointer'}
				evi-transition
				border border-evi-border-3
            `}
			onClick={() => {
				if (threadIsRunning) return
				if (isDisabled) return
				chatThreadService.jumpToCheckpointBeforeMessageIdx({
					threadId,
					messageIdx,
					jumpToUserModified: messageIdx === (chatThreadService.state.allThreads[threadId]?.messages.length ?? 0) - 1
				})
			}}
			{...isDisabled ? {
				'data-tooltip-id': 'evi-tooltip',
				'data-tooltip-content': `Disabled ${isRunning ? 'when running' : 'because another thread is running'}`,
				'data-tooltip-place': 'top',
			} : {}}
		>
			Checkpoint
		</div>
	</div>
}


type ChatBubbleMode = 'display' | 'edit'
type ChatBubbleProps = {
	chatMessage: ChatMessage,
	messageIdx: number,
	isCommitted: boolean,
	chatIsRunning: IsRunningType,
	threadId: string,
	currCheckpointIdx: number | undefined,
	_scrollToBottom: (() => void) | null,
}

const ChatBubble = (props: ChatBubbleProps) => {
	return <ErrorBoundary>
		<_ChatBubble {...props} />
	</ErrorBoundary>
}

const _ChatBubble = ({ threadId, chatMessage, currCheckpointIdx, isCommitted, messageIdx, chatIsRunning, _scrollToBottom }: ChatBubbleProps) => {
	const role = chatMessage.role

	const isCheckpointGhost = messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning // whether to show as gray (if chat is running, for good measure just dont show any ghosts)

	if (role === 'user') {
		return <UserMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			currCheckpointIdx={currCheckpointIdx}
			messageIdx={messageIdx}
			_scrollToBottom={_scrollToBottom}
		/>
	}
	else if (role === 'assistant') {
		return <AssistantMessageComponent
			chatMessage={chatMessage}
			isCheckpointGhost={isCheckpointGhost}
			messageIdx={messageIdx}
			isCommitted={isCommitted}
		/>
	}
	else if (role === 'tool') {

		if (chatMessage.type === 'invalid_params') {
			return <div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
				<InvalidTool toolName={chatMessage.name} message={chatMessage.content} mcpServerName={chatMessage.mcpServerName} />
			</div>
		}

		const toolName = chatMessage.name
		const isBuiltInTool = isABuiltinToolName(toolName)
		const ToolResultWrapper = isBuiltInTool ? builtinToolNameToComponent[toolName]?.resultWrapper as ResultWrapper<ToolName>
			: MCPToolWrapper as ResultWrapper<ToolName>

		if (ToolResultWrapper)
			return <>
				<div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
					<ToolResultWrapper
						toolMessage={chatMessage}
						messageIdx={messageIdx}
						threadId={threadId}
					/>
				</div>
				{chatMessage.type === 'tool_request' ?
					<div className={`${isCheckpointGhost ? 'opacity-50 pointer-events-none' : ''}`}>
						<ToolRequestAcceptRejectButtons toolName={chatMessage.name} />
					</div> : null}
			</>
		return null
	}

	else if (role === 'interrupted_streaming_tool') {
		return <div className={`${isCheckpointGhost ? 'opacity-50' : ''}`}>
			<CanceledTool toolName={chatMessage.name} mcpServerName={chatMessage.mcpServerName} />
		</div>
	}

	else if (role === 'checkpoint') {
		return <Checkpoint
			threadId={threadId}
			message={chatMessage}
			messageIdx={messageIdx}
			isCheckpointGhost={isCheckpointGhost}
			threadIsRunning={!!chatIsRunning}
		/>
	}

}

const CommandBarInChat = () => {
	const { stateOfURI: commandBarStateOfURI, sortedURIs: sortedCommandBarURIs } = useCommandBarState()
	const numFilesChanged = sortedCommandBarURIs.length

	const accessor = useAccessor()
	const editCodeService = accessor.get('IEditCodeService')
	const commandService = accessor.get('ICommandService')
	const chatThreadsState = useChatThreadsState()
	const commandBarState = useCommandBarState()
	const chatThreadsStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId)

	// (
	// 	<IconShell1
	// 		Icon={CopyIcon}
	// 		onClick={copyChatToClipboard}
	// 		data-tooltip-id='evi-tooltip'
	// 		data-tooltip-place='top'
	// 		data-tooltip-content='Copy chat JSON'
	// 	/>
	// )

	const [fileDetailsOpenedState, setFileDetailsOpenedState] = useState<'auto-opened' | 'auto-closed' | 'user-opened' | 'user-closed'>('auto-closed');
	const isFileDetailsOpened = fileDetailsOpenedState === 'auto-opened' || fileDetailsOpenedState === 'user-opened';


	useEffect(() => {
		// close the file details if there are no files
		// this converts 'user-closed' to 'auto-closed'
		if (numFilesChanged === 0) {
			setFileDetailsOpenedState('auto-closed')
		}
		// open the file details if it hasnt been closed
		if (numFilesChanged > 0 && fileDetailsOpenedState !== 'user-closed') {
			setFileDetailsOpenedState('auto-opened')
		}
	}, [fileDetailsOpenedState, setFileDetailsOpenedState, numFilesChanged])


	const isFinishedMakingThreadChanges = (
		// there are changed files
		commandBarState.sortedURIs.length !== 0
		// none of the files are streaming
		&& commandBarState.sortedURIs.every(uri => !commandBarState.stateOfURI[uri.fsPath]?.isStreaming)
	)

	// ======== status of agent ========
	// This icon answers the question "is the LLM doing work on this thread?"
	// assume it is single threaded for now
	// green = Running
	// orange = Requires action
	// dark = Done

	const threadStatus = (
		chatThreadsStreamState?.isRunning === 'awaiting_user' ? { title: 'Needs Approval', color: 'yellow', } as const
			: chatThreadsStreamState?.isRunning ? { title: 'Running', color: 'orange', } as const
				: { title: 'Done', color: 'dark', } as const
	)


	const threadStatusHTML = <StatusIndicator className='mx-1' indicatorColor={threadStatus.color} title={threadStatus.title} />


	// ======== info about changes ========
	// num files changed
	// acceptall + rejectall
	// popup info about each change (each with num changes + acceptall + rejectall of their own)

	const numFilesChangedStr = numFilesChanged === 0 ? 'No files with changes'
		: `${sortedCommandBarURIs.length} file${numFilesChanged === 1 ? '' : 's'} with changes`




	const acceptRejectAllButtons = <div
		className={`flex items-center gap-1
			${isFinishedMakingThreadChanges ? '' : 'opacity-0 pointer-events-none'}`
		}
	>
		<IconShell1 // RejectAllButtonWrapper
			Icon={X}
			onClick={() => {
				sortedCommandBarURIs.forEach(uri => {
					editCodeService.acceptOrRejectAllDiffAreas({
						uri,
						removeCtrlKs: true,
						behavior: "reject",
						_addToHistory: true,
					});
				});
			}}
			data-tooltip-id='evi-tooltip'
			data-tooltip-place='top'
			data-tooltip-content='Reject all'
			className="opacity-60 hover:opacity-100 evi-transition"
		/>

		<IconShell1 // AcceptAllButtonWrapper
			Icon={Check}
			onClick={() => {
				sortedCommandBarURIs.forEach(uri => {
					editCodeService.acceptOrRejectAllDiffAreas({
						uri,
						removeCtrlKs: true,
						behavior: "accept",
						_addToHistory: true,
					});
				});
			}}
			data-tooltip-id='evi-tooltip'
			data-tooltip-place='top'
			data-tooltip-content='Accept all'
			className="opacity-60 hover:opacity-100 evi-transition"
		/>

	</div>


	// !select-text cursor-auto
	const fileDetailsContent = <div className="px-2 gap-1 w-full overflow-y-auto">
		{sortedCommandBarURIs.map((uri, i) => {
			const basename = getBasename(uri.fsPath)

			const { sortedDiffIds, isStreaming } = commandBarStateOfURI[uri.fsPath] ?? {}
			const isFinishedMakingFileChanges = !isStreaming

			const numDiffs = sortedDiffIds?.length || 0

			const fileStatus = (isFinishedMakingFileChanges
				? { title: 'Done', color: 'dark', } as const
				: { title: 'Running', color: 'orange', } as const
			)

			const fileNameHTML = <div
				className="flex items-center gap-1.5 text-evi-fg-3 hover:brightness-125 transition-all duration-200 cursor-pointer"
				onClick={() => eviOpenFileFn(uri, accessor)}
			>
				{/* <FileIcon size={14} className="text-evi-fg-3" /> */}
				<span className="text-evi-fg-3">{basename}</span>
			</div>




			const detailsContent = <div className='flex px-4'>
				<span className="text-evi-fg-3 opacity-80">{numDiffs} diff{numDiffs !== 1 ? 's' : ''}</span>
			</div>

			const acceptRejectButtons = <div
				// do this with opacity so that the height remains the same at all times
				className={`flex items-center gap-0.5
					${isFinishedMakingFileChanges ? '' : 'opacity-0 pointer-events-none'}
				`}
			>
				{/* <JumpToFileButton
					uri={uri}
					data-tooltip-id='evi-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Go to file'
				/> */}
				<IconShell1 // RejectAllButtonWrapper
					Icon={X}
					onClick={() => { editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "reject", _addToHistory: true, }); }}
					data-tooltip-id='evi-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Reject file'

				/>
				<IconShell1 // AcceptAllButtonWrapper
					Icon={Check}
					onClick={() => { editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "accept", _addToHistory: true, }); }}
					data-tooltip-id='evi-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Accept file'
				/>

			</div>

			const fileStatusHTML = <StatusIndicator className='mx-1' indicatorColor={fileStatus.color} title={fileStatus.title} />

			return (
				// name, details
				<div key={i} className="flex justify-between items-center">
					<div className="flex items-center">
						{fileNameHTML}
						{detailsContent}
					</div>
					<div className="flex items-center gap-2">
						{acceptRejectButtons}
						{fileStatusHTML}
					</div>
				</div>
			)
		})}
	</div>

	const fileDetailsButton = (
		<button
			className={`flex items-center gap-1.5 rounded-lg evi-transition ${numFilesChanged === 0 ? 'cursor-pointer opacity-50' : 'cursor-pointer hover:opacity-80'}`}
			onClick={() => isFileDetailsOpened ? setFileDetailsOpenedState('user-closed') : setFileDetailsOpenedState('user-opened')}
			type='button'
			disabled={numFilesChanged === 0}
		>
			<svg
				className="evi-transition size-3"
				style={{
					transform: isFileDetailsOpened ? 'rotate(0deg)' : 'rotate(180deg)',
				}}
				xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline>
			</svg>
			<span className="font-medium">{numFilesChangedStr}</span>
		</button>
	)

	return (
		<>
			{/* file details */}
			<div className='px-2'>
				<div
					className={`
						select-none
						flex w-full rounded-xl bg-evi-bg-2
						text-evi-fg-3 text-xs text-nowrap

						overflow-hidden transition-all duration-200 ease-in-out
						${isFileDetailsOpened ? 'max-h-32 my-1' : 'max-h-0'}
					`}
				>
					{fileDetailsContent}
				</div>
			</div>
			{/* main content */}
			<div
				className={`
					select-none
					flex w-full rounded-xl bg-evi-bg-2
					text-evi-fg-3 text-xs text-nowrap
					border border-evi-border-3

					px-3 py-1.5
					justify-between
					items-center
				`}
			>
				<div className="flex gap-2 items-center">
					{fileDetailsButton}
				</div>
				<div className="flex gap-2 items-center">
					{acceptRejectAllButtons}
					{threadStatusHTML}
				</div>
			</div>
		</>
	)
}



const EditToolSoFar = ({ toolCallSoFar, }: { toolCallSoFar: RawToolCallObj }) => {

	if (!isABuiltinToolName(toolCallSoFar.name)) return null

	const accessor = useAccessor()

	const uri = toolCallSoFar.rawParams.uri ? URI.file(toolCallSoFar.rawParams.uri) : undefined

	const title = titleOfBuiltinToolName[toolCallSoFar.name].proposed

	const uriDone = toolCallSoFar.doneParams.includes('uri')
	const desc1 = <span className='flex items-center gap-1'>
		{uriDone ?
			getBasename(toolCallSoFar.rawParams['uri'] ?? 'unknown')
			: `Generating`}
		<IconLoading className='opacity-60' />
	</span>

	const desc1OnClick = () => { uri && eviOpenFileFn(uri, accessor) }

	// If URI has not been specified
	return <ToolHeaderWrapper
		title={title}
		desc1={desc1}
		desc1OnClick={desc1OnClick}
	>
		<EditToolChildren
			uri={uri}
			code={toolCallSoFar.rawParams.search_replace_blocks ?? toolCallSoFar.rawParams.new_content ?? ''}
			type={'rewrite'} // as it streams, show in rewrite format, don't make a diff editor
		/>
	</ToolHeaderWrapper>

}


export const SidebarChat = () => {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const textAreaFnsRef = useRef<TextAreaFns | null>(null)

	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const eviSettingsService = accessor.get('IEviSettingsService')

	const settingsState = useSettingsState()
	// ----- HIGHER STATE -----

	// threads state
	const chatThreadsState = useChatThreadsState()

	const currentThread = chatThreadsService.getCurrentThread()
	const previousMessages = currentThread?.messages ?? []

	const selections = currentThread.state.stagingSelections
	const setSelections = (s: StagingSelectionItem[]) => { chatThreadsService.setCurrentThreadState({ stagingSelections: s }) }

	// stream state
	const currThreadStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId)
	const isRunning = currThreadStreamState?.isRunning
	const latestError = currThreadStreamState?.error
	const { displayContentSoFar, toolCallSoFar, reasoningSoFar } = currThreadStreamState?.llmInfo ?? {}

	// this is just if it's currently being generated, NOT if it's currently running
	const toolIsGenerating = toolCallSoFar && !toolCallSoFar.isDone // show loading for slow tools (right now just edit)

	// ----- SIDEBAR CHAT state (local) -----

	// state of current message
	const initVal = ''
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(!initVal)

	const isDisabled = instructionsAreEmpty || !!isFeatureNameDisabled('Chat', settingsState)

	const sidebarRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)
	const onSubmit = useCallback(async (_forceSubmit?: string) => {

		if (isDisabled && !_forceSubmit) return
		if (isRunning) return

		const threadId = chatThreadsService.state.currentThreadId

		// send message to LLM
		const userMessage = _forceSubmit || textAreaRef.current?.value || ''

		try {
			await chatThreadsService.addUserMessageAndStreamResponse({ userMessage, threadId })
		} catch (e) {
			console.error('Error while sending message in chat:', e)
		}

		setSelections([]) // clear staging
		textAreaFnsRef.current?.setValue('')
		textAreaRef.current?.focus() // focus input after submit

	}, [chatThreadsService, isDisabled, isRunning, textAreaRef, textAreaFnsRef, setSelections, settingsState])

	const onAbort = async () => {
		const threadId = currentThread.id
		await chatThreadsService.abortRunning(threadId)
	}

	const keybindingString = accessor.get('IKeybindingService').lookupKeybinding(EVI_CTRL_L_ACTION_ID)?.getLabel()

	const threadId = currentThread.id
	const currCheckpointIdx = chatThreadsState.allThreads[threadId]?.state?.currCheckpointIdx ?? undefined  // if not exist, treat like checkpoint is last message (infinity)



	// resolve mount info
	const isResolved = chatThreadsState.allThreads[threadId]?.state.mountedInfo?.mountedIsResolvedRef.current
	useEffect(() => {
		if (isResolved) return
		chatThreadsState.allThreads[threadId]?.state.mountedInfo?._whenMountedResolver?.({
			textAreaRef: textAreaRef,
			scrollToBottom: () => scrollToBottom(scrollContainerRef),
		})

	}, [chatThreadsState, threadId, textAreaRef, scrollContainerRef, isResolved])




	const previousMessagesHTML = useMemo(() => {
		// const lastMessageIdx = previousMessages.findLastIndex(v => v.role !== 'checkpoint')
		// tool request shows up as Editing... if in progress
		return previousMessages.map((message, i) => {
			return <ChatBubble
				key={i}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={message}
				messageIdx={i}
				isCommitted={true}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={() => scrollToBottom(scrollContainerRef)}
			/>
		})
	}, [previousMessages, threadId, currCheckpointIdx, isRunning])

	const streamingChatIdx = previousMessagesHTML.length
	const currStreamingMessageHTML = reasoningSoFar || displayContentSoFar || isRunning ?
		<ChatBubble
			key={'curr-streaming-msg'}
			currCheckpointIdx={currCheckpointIdx}
			chatMessage={{
				role: 'assistant',
				displayContent: displayContentSoFar ?? '',
				reasoning: reasoningSoFar ?? '',
				anthropicReasoning: null,
			}}
			messageIdx={streamingChatIdx}
			isCommitted={false}
			chatIsRunning={isRunning}

			threadId={threadId}
			_scrollToBottom={null}
		/> : null


	// the tool currently being generated
	const generatingTool = toolIsGenerating ?
		toolCallSoFar.name === 'edit_file' || toolCallSoFar.name === 'rewrite_file' ? <EditToolSoFar
			key={'curr-streaming-tool'}
			toolCallSoFar={toolCallSoFar}
		/>
			: null
		: null

	const messagesHTML = <ScrollToBottomContainer
		key={'messages' + chatThreadsState.currentThreadId} // force rerender on all children if id changes
		scrollContainerRef={scrollContainerRef}
		className={`
			flex flex-col
			px-4 py-4 gap-3
			w-full h-full
			overflow-x-hidden
			overflow-y-auto
			evi-scrollbar
			${previousMessagesHTML.length === 0 && !displayContentSoFar ? 'hidden' : ''}
		`}
	>
		{/* previous messages */}
		{previousMessagesHTML}
		{currStreamingMessageHTML}

		{/* Generating tool */}
		{generatingTool}

		{/* loading indicator */}
		{isRunning === 'LLM' || isRunning === 'idle' && !toolIsGenerating ?
			<div className="flex items-center gap-2 px-2">
				<div className="evi-shimmer w-6 h-6 rounded-full" />
				<div className="evi-shimmer h-3 w-24 rounded-full" />
				<IconLoading className='opacity-60 text-sm ml-1' />
			</div> : null}


		{/* error message */}
		{latestError === undefined ? null :
			<div className='px-2 my-1'>
				<ErrorDisplay
					message={latestError.message}
					fullError={latestError.fullError}
					onDismiss={() => { chatThreadsService.dismissStreamError(currentThread.id) }}
					showDismiss={true}
				/>

				<WarningBox className='text-sm my-2 mx-4' onClick={() => { commandService.executeCommand(EVI_OPEN_SETTINGS_ACTION_ID) }} text='Open settings' />
			</div>
		}
	</ScrollToBottomContainer>


	const onChangeText = useCallback((newStr: string) => {
		setInstructionsAreEmpty(!newStr)
	}, [setInstructionsAreEmpty])
	const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			onSubmit()
		} else if (e.key === 'Escape' && isRunning) {
			onAbort()
		}
	}, [onSubmit, onAbort, isRunning])

	const inputChatArea = <VoidChatArea
		featureName='Chat'
		onSubmit={() => onSubmit()}
		onAbort={onAbort}
		isStreaming={!!isRunning}
		isDisabled={isDisabled}
		showSelections={true}
		// showProspectiveSelections={previousMessagesHTML.length === 0}
		selections={selections}
		setSelections={setSelections}
		onClickAnywhere={() => { textAreaRef.current?.focus() }}
	>
		<EviInputBox2
			enableAtToMention
			className={`min-h-[81px] px-0.5 py-0.5`}
			placeholder={`@ to mention, ${keybindingString ? `${keybindingString} to add a selection. ` : ''}Enter instructions...`}
			onChangeText={onChangeText}
			onKeyDown={onKeyDown}
			onFocus={() => { chatThreadsService.setCurrentlyFocusedMessageIdx(undefined) }}
			ref={textAreaRef}
			fnsRef={textAreaFnsRef}
			multiline={true}
		/>

	</VoidChatArea>


	const isLandingPage = previousMessages.length === 0


	const initiallySuggestedPromptsHTML = <div className='grid grid-cols-1 gap-2 w-full text-evi-fg-3 select-none'>
		{[
			{ text: 'Summarize my codebase', icon: '📋' },
			{ text: 'How do types work in Rust?', icon: '📘' },
			{ text: 'Create a .evirules file for me', icon: '📝' }
		].map(({ text, icon }, index) => (
			<div
				key={index}
				className='group flex items-center gap-2 py-2 px-3 rounded-xl text-sm cursor-pointer evi-tool-card evi-transition hover:border-evi-border-2'
				onClick={() => onSubmit(text)}
			>
				<span className="text-base opacity-70 group-hover:opacity-100 evi-transition">{icon}</span>
				<span className="opacity-70 group-hover:opacity-100 evi-transition">{text}</span>
			</div>
		))}
	</div>



	const featureDisabledReason = isFeatureNameDisabled('Chat', settingsState)
	const needsSetup = !!featureDisabledReason && previousMessages.length === 0
	const disabledReason = needsSetup ? featureDisabledReason : null
	const needsApiKey = disabledReason === 'addProvider'

	const [apiKeyInput, setApiKeyInput] = useState('')

	const handleSaveApiKey = useCallback(() => {
		const key = apiKeyInput.trim()
		if (!key) return
		eviSettingsService.setSettingOfProvider('deepseek', 'apiKey', key)
	}, [apiKeyInput, eviSettingsService])

	const setupBanner = needsSetup ? (
		<div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
			<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B1A1A] to-[#4A1010] flex items-center justify-center shadow-sm">
				<Brain className="w-6 h-6 text-white" />
			</div>
			<div>
				<div className="text-base font-semibold text-evi-fg-0 mb-1">No provider configured</div>
				<div className="text-sm text-evi-fg-3 max-w-xs">
					{needsApiKey
						? 'Enter your DeepSeek API key to start coding with Evi.'
						: 'Configure a provider in settings to start using the chat.'}
				</div>
			</div>
			{needsApiKey ? (
				<div className="flex flex-col items-center gap-2 w-full max-w-sm">
					<div className="flex gap-2 w-full">
						<input
							value={apiKeyInput}
							onChange={e => setApiKeyInput(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey() }}
							placeholder="sk-..."
							className="flex-1 resize-none bg-evi-bg-1 text-evi-fg-1 placeholder:text-evi-fg-3 border border-evi-border-2 focus:border-evi-border-1 py-2 px-3 rounded"
							style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
						/>
						<button
							onClick={handleSaveApiKey}
							disabled={!apiKeyInput.trim()}
							className="px-4 py-2 rounded text-sm font-medium bg-gradient-to-r from-[#8B1A1A] to-[#6B1515] text-white hover:from-[#A52A2A] hover:to-[#4A1010] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
						>
							Save
						</button>
					</div>
					<button
						onClick={() => commandService.executeCommand(EVI_OPEN_SETTINGS_ACTION_ID)}
						className="text-xs text-evi-fg-3 hover:text-evi-fg-1 underline transition-colors"
					>
						Advanced settings
					</button>
				</div>
			) : (
				<button
					onClick={() => commandService.executeCommand(EVI_OPEN_SETTINGS_ACTION_ID)}
					className="px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#8B1A1A] to-[#6B1515] text-white hover:from-[#A52A2A] hover:to-[#4A1010] shadow-sm hover:shadow-md transition-all duration-200"
				>
					Open Settings
				</button>
			)}
		</div>
	) : null

	const threadPageInput = needsSetup ? null : <div key={'input' + chatThreadsState.currentThreadId} className="border-t border-evi-border-3">
		<div className='px-3 pt-1.5'>
			<CommandBarInChat />
		</div>
		<div className='px-2 pb-2 pt-1'>
			{inputChatArea}
		</div>
	</div>

	const landingPageInput = <div>
		{needsSetup ? setupBanner : <div className='pt-10 pb-2'>
			{inputChatArea}
		</div>}
	</div>

	const landingPageContent = needsSetup ? (
		<div ref={sidebarRef} className='w-full h-full max-h-full flex flex-col items-center justify-center px-4 evi-scrollbar'>
			{setupBanner}
		</div>
	) : (
		<div
			ref={sidebarRef}
			className='w-full h-full max-h-full flex flex-col overflow-auto px-4 evi-scrollbar'
		>
			<ErrorBoundary>
				{landingPageInput}
			</ErrorBoundary>

			{Object.keys(chatThreadsState.allThreads).length > 1 ?
				<ErrorBoundary>
					<div className='pt-6 mb-3 text-evi-fg-4 text-xs font-medium uppercase tracking-wider select-none pointer-events-none'>Previous Threads</div>
					<PastThreadsList />
				</ErrorBoundary>
				:
				<ErrorBoundary>
					<div className='pt-6 mb-3 text-evi-fg-4 text-xs font-medium uppercase tracking-wider select-none pointer-events-none'>Suggestions</div>
					{initiallySuggestedPromptsHTML}
				</ErrorBoundary>
			}
		</div>
	)


	// const threadPageContent = <div>
	// 	{/* Thread content */}
	// 	<div className='flex flex-col overflow-hidden'>
	// 		<div className={`overflow-hidden ${previousMessages.length === 0 ? 'h-0 max-h-0 pb-2' : ''}`}>
	// 			<ErrorBoundary>
	// 				{messagesHTML}
	// 			</ErrorBoundary>
	// 		</div>
	// 		<ErrorBoundary>
	// 			{inputForm}
	// 		</ErrorBoundary>
	// 	</div>
	// </div>
	const threadPageContent = <div
		ref={sidebarRef}
		className='w-full h-full flex flex-col overflow-hidden'
	>

		<ErrorBoundary>
			{messagesHTML}
		</ErrorBoundary>
		<ErrorBoundary>
			{threadPageInput}
		</ErrorBoundary>
	</div>


	return (
		<Fragment key={threadId} // force rerender when change thread
		>
			{isLandingPage ?
				landingPageContent
				: threadPageContent}
		</Fragment>
	)
}
