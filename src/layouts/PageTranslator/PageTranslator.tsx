import React, { FC, useCallback, useMemo } from 'react';
import { cn } from '@bem-react/classname';

import { Checkbox } from 'react-elegant-ui/esm/components/Checkbox/Checkbox.bundle/desktop';
import { Button } from '../../components/Button/Button.bundle/desktop';
import { Select } from '../../components/Select/Select.bundle/desktop';
import { LanguagePanel } from '../../components/LanguagePanel/LanguagePanel';

import { getMessage } from '../../lib/language';
import { MutableValue } from '../../types/utils';

import { TabData } from '../../pages/popup/layout/PopupWindow';
import { PageTranslateState } from '../../modules/PageTranslator/PageTranslator';

import './PageTranslator.css';

export const cnPageTranslator = cn('PageTranslator');

export const sitePreferenceOptions = {
	default: 'default',
	always: 'always',
	never: 'never',
	defaultForThisLang: 'defaultForThisLang',
	alwaysForThisLang: 'alwaysForThisLang',
	neverForThisLang: 'neverForThisLang',
} as const;

export interface PageTranslatorProps
	extends MutableValue<'from', string | undefined>,
		MutableValue<'to', string | undefined>,
		MutableValue<'translateSite', string>,
		MutableValue<'translateLang', boolean> {
	/**
	 * Features of translator module
	 */
	translatorFeatures: TabData['translatorFeatures'];

	hostname: string;

	showCounters?: boolean;

	isTranslated: boolean;

	toggleTranslate: () => void;

	counters: PageTranslateState;
}

/**
 * Component represent UI for translate current page
 */
export const PageTranslator: FC<PageTranslatorProps> = ({
	translatorFeatures,
	from,
	setFrom,
	to,
	setTo,
	hostname,
	translateSite,
	setTranslateSite,
	translateLang,
	setTranslateLang,
	showCounters,
	toggleTranslate,
	isTranslated,
	counters,
}) => {
	const actionBtnText = getMessage(
		isTranslated ? 'pageTranslator_showOriginal' : 'pageTranslator_translatePage',
	);

	const escapedHostname = useMemo(
		() => (hostname.length <= 50 ? hostname : hostname.slice(0, 80) + '...'),
		[hostname],
	);
	const localizedLang = useMemo(
		() => getMessage(from === 'auto' ? 'lang_detect' : 'langCode_' + from),
		[from],
	);

	const setTranslateStateAdaptor = useCallback(
		(value: string[] | string | undefined) => {
			if (typeof value === 'string' && value in sitePreferenceOptions) {
				setTranslateSite(value);
			}
		},
		[setTranslateSite],
	);

	const translateSiteOptions = useMemo(
		() =>
			[
				'default',
				'never',
				'always',
				'defaultForThisLang',
				'alwaysForThisLang',
				'neverForThisLang',
			].map((key) => ({
				id: key,
				content: getMessage(
					'pageTranslator_sitePreferences_autoTranslate_' + key,
				),
			})),
		[],
	);

	return (
		<div className={cnPageTranslator()}>
			<div className={cnPageTranslator('Direction')}>
				<Button view="action" onPress={toggleTranslate}>
					{actionBtnText}
				</Button>{' '}
				<LanguagePanel
					auto={translatorFeatures.isSupportAutodetect}
					languages={translatorFeatures.supportedLanguages}
					from={from}
					to={to}
					setFrom={setFrom}
					setTo={setTo}
				/>
			</div>

			<ul className={cnPageTranslator('List')}>
				{/* <li className={cnPageTranslator('ListItem')}>
					<Checkbox
						label={
							getMessage('pageTranslator_alwaysTranslateSite') +
							` (${escapedHostname})`
						}
						checked={translateSite}
						setChecked={setTranslateSite}
					/>
				</li> */}
				<li className={cnPageTranslator('ListItem')}>
					<Checkbox
						label={
							getMessage('pageTranslator_alwaysTranslateLang') +
							` (${localizedLang})`
						}
						checked={translateLang}
						setChecked={setTranslateLang}
					/>
				</li>
			</ul>

			{/* TODO: use classes for styles */}
			<div>
				<h4 className={cnPageTranslator('Header')}>
					{getMessage('pageTranslator_sitePreferences_title')} {escapedHostname}
				</h4>
				<span style={{ marginRight: '.5rem' }}>
					{getMessage('pageTranslator_sitePreferences_autoTranslate_title')}
				</span>
				<span style={{ marginRight: '.5rem' }}>
					<Select
						options={translateSiteOptions}
						value={translateSite}
						setValue={setTranslateStateAdaptor}
					/>
				</span>
			</div>

			{showCounters ? (
				<>
					<h4 className={cnPageTranslator('Header')}>
						{getMessage('pageTranslator_translationReport')}
					</h4>
					<div className={cnPageTranslator('CounterContainer')}>
						<span className={cnPageTranslator('Counter')}>
							{getMessage('pageTranslator_translationReport_resolve')}
							<span className={cnPageTranslator('CounterContent')}>
								{counters !== undefined ? counters.resolved : 0}
							</span>
						</span>
						<span className={cnPageTranslator('Counter')}>
							{getMessage('pageTranslator_translationReport_reject')}
							<span className={cnPageTranslator('CounterContent')}>
								{counters !== undefined ? counters.rejected : 0}
							</span>
						</span>
						<span className={cnPageTranslator('Counter')}>
							{getMessage('pageTranslator_translationReport_queue')}
							<span className={cnPageTranslator('CounterContent')}>
								{counters !== undefined ? counters.pending : 0}
							</span>
						</span>
					</div>
				</>
			) : undefined}
		</div>
	);
};
