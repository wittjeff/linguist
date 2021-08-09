import { addRequestHandler, bgSendRequest } from '../../../../lib/communication';
import { tryDecode, type } from '../../../../lib/types';
import { RequestHandlerFactory } from '../../../types';
import { deleteLanguage } from './utils';

export const deleteAutoTranslatedLang = (lang: string): Promise<void> =>
	bgSendRequest('deleteAutoTranslatedLang', lang);

export const deleteAutoTranslatedLangFactory: RequestHandlerFactory = () => {
	addRequestHandler('deleteAutoTranslatedLang', async (rawData) => {
		const lang = tryDecode(type.string, rawData);
		await deleteLanguage(lang);
	});
};
