import { combine, createEvent, createStore, Store, sample } from 'effector';
import { runByReadyState } from 'react-elegant-ui/esm/lib/runByReadyState';

import { AppConfigType } from '../../types/runtime';
import { getPageLanguage } from '../../lib/browser';

// Requests
import { getSitePreferences } from '../../requests/backend/autoTranslation/sitePreferences/getSitePreferences';
import { getLanguagePreferences } from '../../requests/backend/autoTranslation/languagePreferences/getLanguagePreferences';
import { isRequireTranslateBySitePreferences } from '../../layouts/PageTranslator/PageTranslator.utils/utils';

import { PageTranslator } from '../PageTranslator/PageTranslator';
import {
	Options as SelectTranslatorOptions,
	SelectTranslator,
} from '../SelectTranslator';

const buildSelectTranslatorOptions = (
	{ mode, ...options }: AppConfigType['selectTranslator'],
	{ pageLanguage }: { pageLanguage?: string },
): SelectTranslatorOptions => ({
	...options,
	pageLanguage,
	quickTranslate: mode === 'quickTranslate',
	enableTranslateFromContextMenu: mode === 'contextMenu',
});

type PageData = {
	language: string | null;
};

type PageTranslationOptions = {
	from: string;
	to: string;
};

type TranslatorsState = {
	pageTranslation: PageTranslationOptions | null;
	textTranslation: boolean;
};

// TODO: eliminate `getState` calls
export class PageTranslationContext {
	private $config: Store<AppConfigType>;

	/**
	 * The translators state source of truth
	 */
	private $translatorsState: Store<TranslatorsState>;

	private pageTranslator: PageTranslator;
	constructor($config: Store<AppConfigType>) {
		this.$config = $config;

		// TODO: manage it manually by events everywhere
		this.$translatorsState = createStore<TranslatorsState>({
			pageTranslation: null,
			textTranslation: false,
		});

		const config = $config.getState();

		// Create instances for translation
		this.pageTranslator = new PageTranslator(config.pageTranslator);
	}

	public getDOMTranslator() {
		return this.pageTranslator;
	}

	private selectTranslator: SelectTranslator | null = null;
	public getTextTranslator() {
		return this.selectTranslator;
	}

	private pageData: Store<PageData> | null = null;

	// TODO: move events to another place
	private readonly pageDataControl = {
		updatedLanguage: createEvent<string>(),
		updatedTextTranslationState: createEvent<boolean>(),
		updatedPageTranslationState: createEvent<PageTranslationOptions | null>(),
	} as const;

	// TODO: encapsulate knobs instead of direct access
	public getTranslationKnobs() {
		return this.pageDataControl;
	}

	public async start() {
		const config = this.$config.getState();

		// Collect page data
		const pageLanguage = await getPageLanguage(
			config.pageTranslator.detectLanguageByContent,
		);

		const $pageData = createStore({
			language: pageLanguage,
		});

		$pageData.on(this.pageDataControl.updatedLanguage, (state, language) => ({
			...state,
			language,
		}));

		this.pageData = $pageData;

		await this.startTranslation();
	}

	// TODO: move translation management here
	// TODO: test the code
	private async startTranslation() {
		// TODO: disable translators with order to config changes

		// Subscribe on events
		this.$translatorsState.on(
			this.pageDataControl.updatedPageTranslationState,
			(state, pageTranslation) => ({ ...state, pageTranslation }),
		);

		const updateTextTranslatorState = createEvent<boolean>();

		// TODO: check is possible to toggle
		this.pageDataControl.updatedTextTranslationState.watch(updateTextTranslatorState);

		sample({
			clock: this.pageDataControl.updatedPageTranslationState,
			source: {
				config: this.$config,
				translatorsState: this.$translatorsState,
			},
			fn: (source, newPageTranslationState) => {
				const { config, translatorsState } = source;

				// Enable text translation
				if (newPageTranslationState === null) return true;

				// Disable if necessary
				const isForceDisableTextTranslation =
					config.selectTranslator.disableWhileTranslatePage;

				return translatorsState.textTranslation && !isForceDisableTextTranslation;
			},
			target: updateTextTranslatorState,
		});

		this.$translatorsState.on(
			updateTextTranslatorState,
			(state, textTranslation) => ({ ...state, textTranslation }),
		);

		const $masterStore = combine({
			config: this.$config,
			translatorsState: this.$translatorsState,
		});

		// Manage text translation instance
		$masterStore
			.map(({ config: { selectTranslator } }) => selectTranslator)
			.watch((preferences) => {
				console.warn('TT prefs', preferences);

				if (preferences.enabled) {
					const pageLanguage = this.pageData?.getState().language || undefined;
					const config = buildSelectTranslatorOptions(preferences, {
						pageLanguage,
					});

					if (this.selectTranslator === null) {
						this.selectTranslator = new SelectTranslator(config);
					} else {
						const isRun = this.selectTranslator.isRun();
						if (isRun) {
							this.selectTranslator.stop();
						}

						this.selectTranslator = new SelectTranslator(config);

						if (isRun) {
							this.selectTranslator.start();
						}
					}
				} else {
					if (this.selectTranslator === null) return;

					if (this.selectTranslator.isRun()) {
						this.selectTranslator.stop();
					}

					this.selectTranslator = null;
				}
			});

		// Manage text translation state
		const $isTextTranslationStarted = this.$translatorsState.map(
			({ textTranslation }) => textTranslation,
		);
		$isTextTranslationStarted.watch((isTranslating) => {
			console.warn('TT state', isTranslating);

			if (this.selectTranslator === null) return;
			if (isTranslating === this.selectTranslator.isRun()) return;

			if (isTranslating) {
				this.selectTranslator.start();
			} else {
				this.selectTranslator.stop();
			}
		});

		// Manage page translation instance
		$masterStore.watch(({ config: { pageTranslator: config } }) => {
			if (!this.pageTranslator.isRun()) {
				this.pageTranslator.updateConfig(config);
				return;
			}

			const direction = this.pageTranslator.getTranslateDirection();
			if (direction === null) {
				throw new TypeError('Invalid response from getTranslateDirection method');
			}

			this.pageTranslator.stop();
			this.pageTranslator.updateConfig(config);
			this.pageTranslator.run(direction.from, direction.to);
		});

		// Manage page translation state
		$masterStore.watch(({ translatorsState: { pageTranslation } }) => {
			const shouldTranslate = pageTranslation !== null;
			if (shouldTranslate === this.pageTranslator.isRun()) return;

			if (pageTranslation !== null) {
				this.pageTranslator.run(pageTranslation.from, pageTranslation.to);
			} else {
				this.pageTranslator.stop();
			}
		});

		// TODO: call events to toggle translators states
		updateTextTranslatorState(true);

		// Init page translate
		// TODO: add option to define stage to detect language and run auto translate
		runByReadyState(this.onPageLoaded, 'interactive');
	}

	private onPageLoaded = async () => {
		const pageHost = location.host;

		// TODO: make it option
		const isAllowTranslateSameLanguages = true;

		const config = this.$config.getState();
		const translatorsState = this.$translatorsState.getState();

		// Skip if page already in translating
		if (translatorsState.pageTranslation !== null) return;

		const actualPageLanguage = await getPageLanguage(
			config.pageTranslator.detectLanguageByContent,
		);

		// TODO: make it reactive
		// Update config if language did updated after loading page
		const pageLanguage = this.pageData?.getState().language || undefined;
		if (pageLanguage !== actualPageLanguage && actualPageLanguage !== null) {
			// Update language state
			this.pageDataControl.updatedLanguage(actualPageLanguage);

			// Update config
			// state.update(config);
		}

		// Auto translate page
		const fromLang = actualPageLanguage;
		const toLang = config.language;

		// Skip by common causes
		if (fromLang === undefined) return;
		if (fromLang === toLang && !isAllowTranslateSameLanguages) return;

		let isNeedAutoTranslate = false;

		// Consider site preferences
		const sitePreferences = await getSitePreferences(pageHost);
		const isSiteRequireTranslate =
			fromLang !== null &&
			isRequireTranslateBySitePreferences(fromLang, sitePreferences);
		if (isSiteRequireTranslate !== null) {
			// Never translate this site
			if (!isSiteRequireTranslate) return;

			// Otherwise translate
			isNeedAutoTranslate = true;
		}

		if (fromLang !== null) {
			// Consider common language preferences

			const isLanguageRequireTranslate = await getLanguagePreferences(fromLang);
			if (isLanguageRequireTranslate !== null) {
				// Never translate this language
				if (!isLanguageRequireTranslate) return;

				// Otherwise translate
				isNeedAutoTranslate = true;
			}

			if (isNeedAutoTranslate) {
				this.pageDataControl.updatedPageTranslationState({
					from: fromLang,
					to: toLang,
				});
			}
		}
	};
}
