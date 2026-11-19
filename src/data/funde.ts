// Funde (2D BACKLOG #14 and #27, mockup docs/mockups/m16c-funde.svg, Johannes 2026-11-19): per district
// six Uhrwerkteile (each a small permanent bonus, all six a district bonus) and four Kassetten (story only).
// Each one exists once: picked up it is gone for good; left behind it waits at the same spot next run.
import type { AffixId } from './items';

export type FundKind = 'teil' | 'kassette';
export interface Kassette { readonly title: string; readonly text: string }
export interface DistrictFunde {
  readonly name: string;
  /** District bonus once all Uhrwerkteile of the district are found. */
  readonly bonus: { readonly name: string; readonly affix: AffixId; readonly value: number; readonly text: string };
  readonly kassetten: readonly Kassette[];
}

export const FUNDE_TEILE = 6;
/** Uhrwerkteil i gives +1 % Schaden (even i) or +5 Leben (odd i). */
export const TEIL_BONUS: readonly [{ affix: AffixId; value: number; text: string }, { affix: AffixId; value: number; text: string }] = [
  { affix: 'dmg', value: 1, text: '+1 % Schaden' },
  { affix: 'hp', value: 5, text: '+5 Leben' },
];

/** By district index (Köpenick 0). Texts are drafts (Johannes may replace them). */
export const FUNDE: readonly DistrictFunde[] = [
  { name: 'Köpenick · Urzeit',
    bonus: { name: 'Urzeit-Instinkt', affix: 'crit', value: 3, text: '+3 % Krit-Chance' },
    kassetten: [
      { title: 'Zeitnormal, Probebetrieb', text: 'Sender Köpenick meldet Abweichung. Uhren laufen rückwärts. Bitte bestätigen.' },
      { title: 'Der Hauptmann', text: 'Er trägt eine Uniform von 1906 und gibt Befehle. Die Toten gehorchen.' },
      { title: 'Spreepark, Nachtwache', text: 'Die Saurier aus Beton haben sich bewegt. Ich schwöre es. Heute stehen sie anders.' },
      { title: 'Letzte Durchsage S3', text: 'Zug fällt aus. Grund: Zeitstörung. Bitte nicht zwischen zwei Sekunden stehen bleiben.' },
    ] },
  { name: 'Xhain · 1981',
    bonus: { name: 'Besetzt', affix: 'res', value: 5, text: '+5 % Widerstand' },
    kassetten: [
      { title: 'Rauch-Haus, Plenum', text: 'Die Uhr am Mariannenplatz steht. Wir finden das gut. Keiner muss mehr pünktlich sein.' },
      { title: 'Grenzposten Schillingbrücke', text: 'Der Ablöser kommt nicht. Seit Wochen ist es dieselbe Nacht.' },
      { title: 'Mixtape, Seite B', text: 'Lied Nummer drei läuft seit 1981 in Schleife. Niemand dreht das Band um.' },
      { title: 'Funkspruch Oberbaum', text: 'Die Hexe wäscht Zahnräder in der Spree. Eins davon ist größer als die anderen.' },
    ] },
  { name: 'Alexanderplatz · 1989',
    bonus: { name: 'Planübererfüllung', affix: 'as', value: 5, text: '+5 % Angriffstempo' },
    kassetten: [
      { title: 'Protokoll Weltzeituhr', text: 'Zeitnormal angeschlossen. Alle Uhren Berlins folgen jetzt diesem Sockel. Genosse, es läuft.' },
      { title: 'Herbst, Tag 9000', text: 'Das Laub fällt jeden Tag neu. Die Bäume werden davon nicht leer.' },
      { title: 'Pionierfunk', text: 'Seid bereit! Immer bereit. Auch wenn morgen nie kommt.' },
      { title: 'Notiz am Fernsehturm', text: 'Die Antenne sendet die Zeit in alle Bezirke. Wer sie abstellt, stellt alles ab.' },
    ] },
  { name: 'Mitte · 2089',
    bonus: { name: 'Nachtschicht', affix: 'spd', value: 5, text: '+5 % Lauftempo' },
    kassetten: [
      { title: 'Werbeschleife Sony Center', text: 'Neue Implantate. Neue Zeit. Kaufen Sie jetzt, bevor jetzt vorbei ist.' },
      { title: 'Bassprediger, Mitschnitt', text: 'Der Takt ist die einzige Uhr, die noch richtig geht. Tanzt, und ihr altert nicht.' },
      { title: 'Regierungsviertel, Akte 7', text: 'Zuständigkeit für den Stillstand ungeklärt. Vorgang wird vertagt. Erneut.' },
      { title: 'Letzter Zug U2', text: 'Ein Schaffner auf Normalzeit fährt noch. Wenn du das hörst: Er kommt auch zu dir.' },
    ] },
];

/** Persistent id of one Fund: `d<district>:t<i>` or `d<district>:k<i>`. */
export const fundId = (district: number, kind: FundKind, i: number): string => `d${district}:${kind === 'teil' ? 't' : 'k'}${i}`;

/** Affix bonus of the found Uhrwerkteile (per piece, plus the district bonus when a district is complete). */
export function fundeAffixes(found: readonly string[] | undefined): Partial<Record<AffixId, number>> {
  const a: Partial<Record<AffixId, number>> = {};
  if (!found?.length) return a;
  const add = (id: AffixId, v: number): void => { a[id] = (a[id] ?? 0) + v; };
  FUNDE.forEach((d, district) => {
    let n = 0;
    for (let i = 0; i < FUNDE_TEILE; i++) if (found.includes(fundId(district, 'teil', i))) { n++; const b = TEIL_BONUS[i % 2]!; add(b.affix, b.value); }
    if (n === FUNDE_TEILE) add(d.bonus.affix, d.bonus.value);
  });
  return a;
}
