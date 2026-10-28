// Short encouraging lines for the home screen. The day picks the line, so it changes daily without any storage.
const SENTENCES = [
  'Bugün küçük bir adım bile büyük bir yolculuğun parçasıdır.',
  'Her seans, birinin hayatında yeni bir kapı aralıyor.',
  'Sabırla ilerleyen, gerçekten uzağa gider.',
  'Bugün de değişimin bir parçası olmaya devam ediyorsun.',
  'Emeğin görünmese de iz bırakıyor.',
  'Birinin zorlandığı yerde yanında durmak, en güzel meslek.',
  'Her gün biraz daha iyi bir yer olmak için çabalıyorsun.',
  'Kendine de biraz şefkat göster; sen de bu emeği hak ediyorsun.',
  'Küçük ilerlemeler, uzun yolların en sağlam taşlarıdır.',
  'Bugün birinin hayatına nazik bir dokunuş yapacaksın.',
  'Yorulsan bile, yaptığın işin anlamı seni ileri taşır.',
  'Bir adım daha, bir gülümseme daha.',
  'Yardım eli uzatmak, en cesur şeylerden biri.',
  'Birinin umudunu canlı tutmak, dünyayı biraz daha güzel yapar.',
  'Bugün de kendine ve işine inanmaya devam et.',
];

const NOTES = [
  'Bugün kahveni güzel bir fincanda iç. ♥',
  'Kendine küçük bir mola ver, hak ettin. ♥',
  'Bir mor çiçek seni bugün mutlu edebilir. ♥',
  'Sevdiğin bir şarkı bu günü tatlandırsın. ♥',
  'Bugün kendine bir iyilik yap: bir yürüyüş, bir kitap. ♥',
  'Yıldızlar gibi parlamaya devam et. ♥',
  'Tebessüm etmeyi unutma, bugün senin günün. ♥',
  'Bir bardak su, bir derin nefes. ♥',
  'Seni seven insanları bugün bir kez daha hatırla. ♥',
  'Her yeni gün yeni bir sayfa, ona güzel bir başlangıç yap. ♥',
];

export function motivation(seed) {
  return SENTENCES[seed % SENTENCES.length];
}

export function surprise(seed) {
  return NOTES[(seed * 7 + 3) % NOTES.length];
}
