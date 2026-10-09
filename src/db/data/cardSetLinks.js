// Pokémon listings that existed before the expansion catalog, linked to their expansion and card by hand.
// Each one was checked against TCGdex: the collector number and the expansion's official total match the title.
// Listings that cannot be told apart from their title ("Magcargo di Armonio", "Metagross EX di Rocco" exist in
// several expansions) are deliberately left out: the seller can link them from the edit page.
//
// cardNumber is written like the wizard does ("29/128"); cardExternalId is the TCGdex card id ("<set>-<number>").
const CARD_SET_LINKS = [
  { id: 'dafac570-5d09-4639-ab87-f03d034e9a0a', title: 'Pikachu 29/128 30° anniversario', cardSetId: '30th', cardNumber: '29/128', cardExternalId: '30th-029' },
  { id: 'd95bc56f-9a2e-41cf-b2ed-e515ccaa96ba', title: 'Zeraora 78/182', cardSetId: 'sv10', cardNumber: '78/182', cardExternalId: 'sv10-078' },
  { id: '9f011bee-fa6d-4f1b-9b23-7849bfe2ef02', title: 'Pikachu EX 179/131', cardSetId: 'sv08.5', cardNumber: '179/131', cardExternalId: 'sv08.5-179' },
  // Shining Celebi only exists in the 30th Classic Collection ("30th-c"), where it is card 24 of 30
  { id: 'fddf76fc-a1c9-4a9f-ac1c-69d238b9c583', title: 'Shining Celebi 30° anniversario', cardSetId: '30th-c', cardNumber: '24/30', cardExternalId: '30th-c-024' },
  { id: '6963a600-718c-4931-b508-0533cc369870', title: 'Shining Celebi 106/105 30° Anniversario', cardSetId: '30th-c', cardNumber: '24/30', cardExternalId: '30th-c-024' },
];

module.exports = { CARD_SET_LINKS };
