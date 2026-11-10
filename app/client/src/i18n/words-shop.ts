// 文言の辞書（次に行く予定・店のキャンペーン 🏪）。[日本語, English]。運営向け画面の文言は admin/ 側にある（日本語のみ）。
export const SHOP_WORDS = {
  planAdd: ['次に行く予定に入れる', 'Add to my plans'],
  planIn: ['予定に入れました（{n}/{max}）', 'In your plans ({n}/{max})'],
  planRemove: ['予定から外す', 'Remove from plans'],
  planFull: ['予定は {max} つまで。どれかを外してね', 'Up to {max} plans. Remove one first'],
  planHint: ['行きたい場所を入れておくと、近くのお店の特典が盤に出ることがあります。', 'Add places you want to visit. Perks from nearby shops may appear on your board.'],
  planDoneToast: ['予定に入れました', 'Added to your plans'],
  planRemovedToast: ['予定から外しました', 'Removed from your plans'],
  tShop: ['お店', 'Shop'],
  legendShop: ['お店の特典', 'Shop perk'],
  landShopC: ['お店のマス！「{c}」の券をもらったよ。あしたから使えます', 'Shop square! You got "{c}". Usable from tomorrow'],
  cheerShop: ['お店の特典だよ！「{c}」、あした使ってね', 'A shop perk! Use "{c}" tomorrow'],
  shopSquareLabel: ['{n}マス目に、お店の特典（{c}）', 'Square {n}: shop perk ({c})'],
} as const;
