/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from 'react';
import { useAccessor, useIsDark, useSettingsState } from '../util/services.js';
import { ChevronRight, ExternalLink, Sparkles, Shield, Zap, Monitor, Brain, Check, ArrowLeft } from 'lucide-react';
import { displayInfoOfProviderName, ProviderName, providerNames, isFeatureNameDisabled } from '../../../../common/eviSettingsTypes.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';
import { OneClickSwitchButton, SettingsForProvider } from '../evi-settings-tsx/Settings.js';
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { isLinux } from '../../../../../../../base/common/platform.js';

const OVERRIDE_VALUE = false

export const EviOnboarding = () => {

	const eviSettingsState = useSettingsState()
	const isOnboardingComplete = eviSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE

	const isDark = useIsDark()

	return (
		<div className={`@@evi-scope ${isDark ? 'dark' : ''}`}>
			<div
				className={`
					fixed top-0 right-0 bottom-0 left-0 z-[99999]
					transition-all duration-1000 ${isOnboardingComplete ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
				`}
				style={{
					height: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: isDark
						? 'radial-gradient(ellipse at 50% 50%, #1a1210 0%, #0f0b0a 50%, #070505 100%)'
						: 'radial-gradient(ellipse at 50% 50%, #fdf6f0 0%, #f8ede4 50%, #f5e6d9 100%)',
				}}
			>
				<div
					className="absolute inset-0 overflow-hidden"
					style={{ pointerEvents: 'none' }}
				>
					<div
						className="absolute inset-0 opacity-[0.06]"
						style={{
							backgroundImage: `radial-gradient(circle at 20% 30%, #8B1A1A 0%, transparent 40%), radial-gradient(circle at 80% 70%, #8B1A1A 0%, transparent 40%)`,
						}}
					/>
					<div
						className="absolute inset-0"
						style={{
							backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='%23C4713B' stroke-opacity='0.04' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`,
							opacity: 0.5,
						}}
					/>
				</div>
				<ErrorBoundary>
					<EviOnboardingContent />
				</ErrorBoundary>
			</div>
		</div>
	)
}

const EviIcon = () => {
	const accessor = useAccessor()
	const themeService = accessor.get('IThemeService')

	const divRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const updateTheme = () => {
			const theme = themeService.getColorTheme().type
			const isDark = theme === ColorScheme.DARK || theme === ColorScheme.HIGH_CONTRAST_DARK
			if (divRef.current) {
				divRef.current.style.maxWidth = '160px'
				divRef.current.style.opacity = '0.5'
				divRef.current.style.filter = isDark ? '' : 'invert(1)'
			}
		}
		updateTheme()
		const d = themeService.onDidColorThemeChange(updateTheme)
		return () => d.dispose()
	}, [])

	return <div ref={divRef} className='@@evi-evi-icon scale-125' />
}

const FADE_DURATION_MS = 2000

const FadeIn = ({ children, className, delayMs = 0, durationMs, ...props }: { children: React.ReactNode, delayMs?: number, durationMs?: number, className?: string } & React.HTMLAttributes<HTMLDivElement>) => {

	const [opacity, setOpacity] = useState(0)

	const effectiveDurationMs = durationMs ?? FADE_DURATION_MS

	useEffect(() => {
		const timeout = setTimeout(() => {
			setOpacity(1)
		}, delayMs)
		return () => clearTimeout(timeout)
	}, [setOpacity, delayMs])

	return (
		<div className={className} style={{ opacity, transition: `opacity ${effectiveDurationMs}ms ease-in-out` }} {...props}>
			{children}
		</div>
	)
}

const SlideUp = ({ children, className, delayMs = 0 }: { children: React.ReactNode, delayMs?: number, className?: string }) => {
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const timeout = setTimeout(() => setVisible(true), delayMs)
		return () => clearTimeout(timeout)
	}, [delayMs])

	return (
		<div
			className={className}
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? 'translateY(0)' : 'translateY(12px)',
				transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
			}}
		>
			{children}
		</div>
	)
}

const DeepSeekSetupPage = ({ pageIndex, setPageIndex }: { pageIndex: number, setPageIndex: (index: number) => void }) => {
	const settingsState = useSettingsState();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout | null = null;
		if (errorMessage) {
			timeoutId = setTimeout(() => { setErrorMessage(null); }, 5000);
		}
		return () => { if (timeoutId) clearTimeout(timeoutId); };
	}, [errorMessage]);

	const isDisabled = isFeatureNameDisabled('Chat', settingsState);

	return (
		<div className="w-full max-w-[480px] mx-auto bg-evi-bg-3 rounded-2xl border border-evi-border-3 shadow-2xl overflow-hidden"
			style={{ maxHeight: '80vh' }}
		>
			<div className="px-8 pt-8 pb-2 text-center">
				<div className="flex items-center justify-center gap-2.5 mb-2">
					<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-[#4A1010] flex items-center justify-center shadow-sm">
						<Brain className="w-4.5 h-4.5 text-white" />
					</div>
					<div className="text-xl font-semibold tracking-tight text-evi-fg-0">Connect DeepSeek</div>
				</div>
				<div className="text-sm text-evi-fg-3 leading-relaxed">
					Enter your DeepSeek API key to start coding with Evi.
				</div>
			</div>

			<div className="px-8 py-5 overflow-y-auto evi-scrollbar" style={{ maxHeight: '50vh' }}>
				<SettingsForProvider providerName="deepseek" showProviderTitle={true} showProviderSuggestions={true} />
			</div>

			<div className="px-8 py-4 border-t border-evi-border-3 bg-evi-bg-2/40">
				{errorMessage && (
					<div className="flex items-center gap-2 px-3.5 py-2.5 mb-3 rounded-xl bg-evi-bg-1 border border-evi-border-3 text-sm text-evi-warning w-full">
						<Zap className="w-3.5 h-3.5 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				)}
				<div className="flex items-center justify-between w-full">
					<button
						onClick={() => setPageIndex(pageIndex - 1)}
						className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-evi-fg-3 hover:text-evi-fg-1 hover:bg-evi-bg-2-hover transition-all duration-200"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
						Back
					</button>
					<div className="flex items-center gap-2">
						<button
							onClick={() => { setPageIndex(pageIndex + 1); }}
							className="px-4 py-2 rounded-xl text-sm font-medium text-evi-fg-3 hover:text-evi-fg-1 hover:bg-evi-bg-2-hover transition-all duration-200"
						>
							Skip
						</button>
						<button
							onClick={() => {
								if (!isDisabled) {
									setPageIndex(pageIndex + 1);
									setErrorMessage(null);
								} else {
									setErrorMessage("Please enter your DeepSeek API key before continuing.");
								}
							}}
							onDoubleClick={() => {
								setPageIndex(pageIndex + 1);
								setErrorMessage(null);
							}}
							className={`
								flex items-center gap-1.5 px-5 py-2 rounded-xl font-medium text-sm
								transition-all duration-200
								${isDisabled
									? 'bg-evi-bg-1 text-evi-fg-3 cursor-not-allowed opacity-50'
									: 'bg-gradient-to-r from-[#8B1A1A] to-[#6B1515] text-white hover:from-[#A52A2A] hover:to-[#4A1010] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
								}
							`}
							{...(isDisabled ? {
								'data-tooltip-id': 'evi-tooltip',
								"data-tooltip-content": 'Enter an API key or click Skip to do it later',
								"data-tooltip-place": 'top',
							} : {})}
						>
							Continue
							<ChevronRight className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const OnboardingPageShell = ({ top, bottom, content }: {
	top?: React.ReactNode,
	bottom?: React.ReactNode,
	content?: React.ReactNode,
}) => {
	return (
		<div className="w-full max-w-[480px] mx-auto bg-evi-bg-3 rounded-2xl border border-evi-border-3 shadow-2xl flex flex-col overflow-hidden"
			style={{ maxHeight: '80vh' }}
		>
			{top && (
				<div className="w-full px-8 pt-8 pb-2 shrink-0">{top}</div>
			)}
			{content && (
				<div className="w-full px-8 py-5 flex-1 overflow-y-auto evi-scrollbar">{content}</div>
			)}
			{bottom && (
				<div className="w-full px-8 py-4 shrink-0 border-t border-evi-border-3 bg-evi-bg-2/40">{bottom}</div>
			)}
		</div>
	)
}

const StepIndicator = ({ current, total }: { current: number, total: number }) => (
	<div className="flex items-center justify-center gap-1.5">
		{Array.from({ length: total }, (_, i) => (
			<div
				key={i}
				className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? 'w-6 bg-gradient-to-r from-[#8B1A1A] to-[#6B1515]' : i < current ? 'w-1.5 bg-[#8B1A1A]/40' : 'w-1.5 bg-evi-border-3'}`}
			/>
		))}
	</div>
)

const PrimaryActionButton = ({ children, onClick, ...props }: { children: React.ReactNode, onClick?: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	return (
		<button
			onClick={onClick}
			className={`
				flex items-center justify-center font-medium gap-2 px-8 py-3 text-sm
				bg-gradient-to-r from-[#8B1A1A] to-[#6B1515] text-white
				hover:from-[#A52A2A] hover:to-[#4A1010]
				shadow-sm hover:shadow-lg hover:-translate-y-0.5
				active:translate-y-0 active:shadow-sm
				rounded-xl
				transition-all duration-300 ease-out
				group
			`}
			{...props}
		>
			{children}
			<ChevronRight className="w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5" />
		</button>
	)
}

type WantToUseOption = 'smart' | 'private' | 'cheap' | 'all'

const EviOnboardingContent = () => {

	const accessor = useAccessor()
	const eviSettingsService = accessor.get('IEviSettingsService')
	const voidMetricsService = accessor.get('IMetricsService')

	const eviSettingsState = useSettingsState()

	const [pageIndex, setPageIndex] = useState(0)

	const [wantToUseOption, setWantToUseOption] = useState<WantToUseOption>('smart')

	const [selectedIntelligentProvider, setSelectedIntelligentProvider] = useState<ProviderName>('deepseek');
	const [selectedPrivateProvider, setSelectedPrivateProvider] = useState<ProviderName>('ollama');
	const [selectedAffordableProvider, setSelectedAffordableProvider] = useState<ProviderName>('deepseek');
	const [selectedAllProvider, setSelectedAllProvider] = useState<ProviderName>('deepseek');

	const getSelectedProvider = (): ProviderName => {
		switch (wantToUseOption) {
			case 'smart': return selectedIntelligentProvider;
			case 'private': return selectedPrivateProvider;
			case 'cheap': return selectedAffordableProvider;
			case 'all': return selectedAllProvider;
		}
	}

	const setSelectedProvider = (provider: ProviderName) => {
		switch (wantToUseOption) {
			case 'smart': setSelectedIntelligentProvider(provider); break;
			case 'private': setSelectedPrivateProvider(provider); break;
			case 'cheap': setSelectedAffordableProvider(provider); break;
			case 'all': setSelectedAllProvider(provider); break;
		}
	}

	const providerNamesOfWantToUseOption: { [wantToUseOption in WantToUseOption]: ProviderName[] } = {
		smart: ['deepseek'],
		private: ['ollama', 'vLLM', 'lmStudio'],
		cheap: ['deepseek', 'ollama', 'vLLM'],
		all: providerNames,
	}

	const selectedProviderName = getSelectedProvider();
	const didFillInProviderSettings = selectedProviderName && eviSettingsState.settingsOfProvider[selectedProviderName]._didFillInProviderSettings
	const isApiKeyLongEnoughIfApiKeyExists = selectedProviderName && eviSettingsState.settingsOfProvider[selectedProviderName].apiKey ? eviSettingsState.settingsOfProvider[selectedProviderName].apiKey.length > 15 : true
	const isAtLeastOneModel = selectedProviderName && eviSettingsState.settingsOfProvider[selectedProviderName].models.length >= 1

	const didFillInSelectedProviderSettings = !!(didFillInProviderSettings && isApiKeyLongEnoughIfApiKeyExists && isAtLeastOneModel)

	const lastPagePrevAndNextButtons = <div className="flex items-center justify-between w-full">
		<button
			onClick={() => { setPageIndex(pageIndex - 1) }}
			className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-evi-fg-3 hover:text-evi-fg-1 hover:bg-evi-bg-2-hover transition-all duration-200"
		>
			<ArrowLeft className="w-3.5 h-3.5" />
			Back
		</button>
		<PrimaryActionButton
			onClick={() => {
				eviSettingsService.setGlobalSetting('isOnboardingComplete', true);
				voidMetricsService.capture('Completed Onboarding', { selectedProviderName, wantToUseOption })
			}}
		>Get Started</PrimaryActionButton>
	</div>

	const basicDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Models with the best performance on benchmarks (we recommend DeepSeek).",
		private: "Host on your computer or local network for full data privacy.",
		cheap: "Free and affordable options (DeepSeek V4 Flash is a great choice).",
		all: "",
	}

	const detailedDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Most intelligent and best for agent mode.",
		private: "Private-hosted so your data never leaves your computer or network. [Email us](mailto:founders@evi.cobyzero.com) for help setting up at your company.",
		cheap: "Use great deals like Gemini 2.5 Pro, or self-host a model with Ollama or vLLM for free.",
		all: "",
	}

	useEffect(() => {
		if (selectedIntelligentProvider === undefined) {
			setSelectedIntelligentProvider(providerNamesOfWantToUseOption['smart'][0]);
		}
		if (selectedPrivateProvider === undefined) {
			setSelectedPrivateProvider(providerNamesOfWantToUseOption['private'][0]);
		}
		if (selectedAffordableProvider === undefined) {
			setSelectedAffordableProvider(providerNamesOfWantToUseOption['cheap'][0]);
		}
		if (selectedAllProvider === undefined) {
			setSelectedAllProvider(providerNamesOfWantToUseOption['all'][0]);
		}
	}, []);

	useEffect(() => {
		if (!eviSettingsState.globalSettings.isOnboardingComplete) {
			setPageIndex(0)
		}
	}, [setPageIndex, eviSettingsState.globalSettings.isOnboardingComplete])

	const contentOfIdx: { [pageIndex: number]: React.ReactNode } = {
		0: <div className="flex flex-col items-center gap-10 py-16 px-8 max-w-[420px] mx-auto w-full text-center">
			<SlideUp delayMs={100}>
				<div className='w-36 h-36 flex items-center justify-center mb-2'>
					{!isLinux && <EviIcon />}
				</div>
			</SlideUp>

			<SlideUp delayMs={300} className="space-y-3">
				<h1 className="text-4xl font-bold tracking-tight text-evi-fg-0">
					Welcome to{' '}
					<span className="bg-gradient-to-r from-[#8B1A1A] to-[#4A1010] bg-clip-text text-transparent">
						Evi
					</span>
				</h1>
				<p className="text-sm text-evi-fg-3 leading-relaxed max-w-xs mx-auto">
					Your AI-powered coding assistant. Let's get you set up in just a moment.
				</p>
			</SlideUp>

			<SlideUp delayMs={600}>
				<PrimaryActionButton onClick={() => { setPageIndex(1) }}>
					Get Started
				</PrimaryActionButton>
			</SlideUp>

			<SlideUp delayMs={900}>
				<StepIndicator current={0} total={3} />
			</SlideUp>
		</div>,

		1: <DeepSeekSetupPage pageIndex={pageIndex} setPageIndex={setPageIndex} />,

		2: <OnboardingPageShell
			top={
				<div className="text-center">
					<div className="text-xl font-semibold tracking-tight text-evi-fg-0">Settings & Themes</div>
					<p className="text-sm text-evi-fg-3 mt-1">Customize your experience</p>
				</div>
			}
			content={
				<div className="space-y-4">
					<div>
						<h4 className="text-xs font-semibold uppercase tracking-wider text-evi-fg-4 mb-3">Transfer from another editor</h4>
						<div className="space-y-2">
							<OneClickSwitchButton className='w-full px-4 py-3 rounded-xl border border-evi-border-3 hover:border-[#8B1A1A]/30 hover:bg-evi-bg-2-hover transition-all duration-200' fromEditor="VS Code" />
							<OneClickSwitchButton className='w-full px-4 py-3 rounded-xl border border-evi-border-3 hover:border-[#8B1A1A]/30 hover:bg-evi-bg-2-hover transition-all duration-200' fromEditor="Cursor" />
							<OneClickSwitchButton className='w-full px-4 py-3 rounded-xl border border-evi-border-3 hover:border-[#8B1A1A]/30 hover:bg-evi-bg-2-hover transition-all duration-200' fromEditor="Windsurf" />
						</div>
					</div>
				</div>
			}
			bottom={lastPagePrevAndNextButtons}
		/>,
	}

	return (
		<div key={pageIndex} className="w-full mx-auto flex flex-col items-center justify-center px-4"
			style={{ minHeight: '80vh' }}
		>
			<ErrorBoundary>
				{contentOfIdx[pageIndex]}
			</ErrorBoundary>
		</div>
	)

}
