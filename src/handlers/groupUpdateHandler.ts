import { LEADERS_GROUP } from "../config";
import { updateGroup } from "../lib/user";

export function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Konta @zhr.pl')
        .addItem('Aktualizuj grupę instruktorów z zaznaczenia', 'groupUpdateHandler')
        .addToUi();
}

export function groupUpdateHandler() {
    console.info('[groupUpdateHandler] Starting group update from selection');
    const ui = SpreadsheetApp.getUi();
    const selection = SpreadsheetApp.getActiveRange();

    if (!selection) {
        ui.alert('Error', 'Zaznacz komórki z adresami email', ui.ButtonSet.OK);
        return;
    }

    const mailList = selection.getValues()
        .flat()
        .map(mail => String(mail).trim().toLowerCase())
        .filter(mail => mail !== '')
        .filter(mail => {
            // Basic email validation regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(mail);
        });

    if (mailList.length === 0) {
        ui.alert('Error', 'Nie znaleziono poprawnych adresów email w zaznaczeniu', ui.ButtonSet.OK);
        return;
    }


    const response = ui.alert('Jesteś pewien?', `Grupa ${LEADERS_GROUP} zostanie zaktualizowana z ${mailList.length} adresów email:\n${mailList.join(', ')}`, ui.ButtonSet.YES_NO);
    if (response === ui.Button.YES) {
        try {
            const result = updateGroup(mailList);
            console.log(`[groupUpdateHandler] Update result: Added=${result.added.length}, Removed=${result.removed.length}, NotFound=${result.notFound.length}`);
            ui.alert(
                'Zakończono dodawanie',
                `Aktualizacja grupy zakończona:
                
                ${result.added.length} nowych użytkowników: ${result.added.join(', ')}
                
                ${result.removed.length} usunięto: ${result.removed.join(', ')}
                
                ${result.notFound.length} nie znaleziono: ${result.notFound.join(', ')}`,
                ui.ButtonSet.OK
            );
        } catch (error) {
            console.error(`[groupUpdateHandler] Error: ${error}`);
            ui.alert('Error', (error as Error).toString(), ui.ButtonSet.OK);

        }
    }
    console.info('[groupUpdateHandler] Finished group update');
}

