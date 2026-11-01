// Home activity library. Each activity belongs to one area; its flags (messy, noisy, smallParts, effort, seated, tool)
// decide which child-specific tips are added to it in the PDF.
export const AREAS = [
  { id: 'fineMotor', label: 'İnce motor beceriler' },
  { id: 'grossMotor', label: 'Kaba motor ve denge' },
  { id: 'bilateral', label: 'İki el koordinasyonu' },
  { id: 'sensory', label: 'Duyusal düzenleme' },
  { id: 'visual', label: 'Görsel algı' },
  { id: 'selfCare', label: 'Öz bakım' },
  { id: 'attention', label: 'Dikkat ve masa başı' },
  { id: 'prewriting', label: 'Yazı öncesi beceriler' },
];

// What to keep in mind for a child. `when` names the activity flag a tip applies to; 'all' applies to every activity,
// null only adds the general tip at the top of the PDF.
export const FLAGS = [
  {
    id: 'tactile',
    label: 'Dokunsal hassasiyet',
    tip: 'Yeni dokuları yavaş tanıştırın. İstemezse zorlamayın; önce siz gösterin, sonra dokunmaya davet edin.',
    when: 'messy',
    adapt: 'Önce kaşık, fırça ya da eldivenle başlayın. Elini silebileceği bir bez hazır olsun.',
  },
  {
    id: 'sound',
    label: 'Sese hassasiyet',
    tip: 'Sessiz ve sakin bir ortam seçin. Yüksek seslerden önce haber verin.',
    when: 'noisy',
    adapt: 'Sesi kısık tutun; isterse kulaklık takabilir ya da yumuşak bir yüzeye vurabilir.',
  },
  {
    id: 'seeking',
    label: 'Çok hareketli, hareket arıyor',
    tip: 'Masa başı çalışmadan önce kısa bir hareket molası verin: zıplama, duvar itme, sepet taşıma.',
    when: 'seated',
    adapt: 'Başlamadan önce 2-3 dakika zıplama ya da duvar itme yaptırın.',
  },
  {
    id: 'shortAttention',
    label: 'Dikkat süresi kısa',
    tip: 'Aktiviteleri kısa bölümlere ayırın ve her bölümün sonunda çabasını övün.',
    when: 'all',
    adapt: '3-5 dakikalık kısa bölümler yapın, sonunda küçük bir ödül verin.',
  },
  {
    id: 'fatigue',
    label: 'Çabuk yoruluyor',
    tip: 'Tekrar sayısını azaltın ve sık mola verin. Yorgunken yeni bir beceri denemeyin.',
    when: 'effort',
    adapt: 'Tekrar sayısını yarıya indirin, aralarda su içme molası verin.',
  },
  {
    id: 'mouthing',
    label: 'Küçük nesneleri ağzına götürüyor',
    tip: 'Küçük parçalı malzemeleri ulaşamayacağı yerde saklayın ve aktivite boyunca yanında olun.',
    when: 'smallParts',
    adapt: 'Küçük parça yerine büyük boy malzeme kullanın ve çocuğunuzu hiç yalnız bırakmayın.',
  },
  {
    id: 'leftHanded',
    label: 'Solak',
    tip: 'Solak olmasını destekleyin, sağ ele zorlamayın.',
    when: 'tool',
    adapt: 'Solak makası kullanın, kağıdı hafifçe sağa eğin; elinin çizgiyi kapatmamasına dikkat edin.',
  },
  {
    id: 'visualSupport',
    label: 'Görsel destekle daha iyi anlıyor',
    tip: 'Adımları resimli kartlarla ya da önce kendiniz yaparak gösterin.',
    when: null,
  },
];

export const ACTIVITIES = [
  // İnce motor
  {
    id: 'mandal', area: 'fineMotor', title: 'Mandal Takma',
    goal: 'Parmak ucu kavrama gücünü ve el kaslarını geliştirir.',
    materials: 'Çamaşır mandalları, karton ya da kutu kenarı',
    steps: ['Mandalları kartonun kenarına tek tek taktırın.', 'Baş parmak ve işaret parmağının ucuyla sıkmasını gösterin.', 'Renk eşleştirmeli kartla zorluğu artırın.', 'Sonunda mandalları çıkarıp kutusuna toplasın.'],
    tip: 'Mandal çok sıkıysa daha yumuşak bir mandalla başlayın.',
    seated: true,
  },
  {
    id: 'hamur', area: 'fineMotor', title: 'Oyun Hamurunda Hazine Avı',
    goal: 'El kaslarını güçlendirir, parmakları ayrı ayrı kullanmayı geliştirir.',
    materials: 'Oyun hamuru, birkaç büyük düğme',
    steps: ['Hamuru yoğurup top ve yılan yapın.', 'Düğmeleri hamurun içine saklayın.', 'Çocuğunuz parmaklarıyla hamuru açarak hazineleri bulsun.', 'Hamuru toplayıp sıkarak bitirin.'],
    tip: 'Sert hamur daha çok kas çalıştırır; yorulursa yumuşak hamura geçin.',
    messy: true, smallParts: true, seated: true,
  },
  {
    id: 'boncuk', area: 'fineMotor', title: 'Boncuk Dizme',
    goal: 'İki elin birlikte çalışmasını ve parmak becerisini geliştirir.',
    materials: 'Büyük delikli boncuklar ya da pipet parçaları, ucu bantlı ip',
    steps: ['İpin bir ucuna düğüm atın, diğer ucunu bantla sertleştirin.', 'Bir eliyle ipi tutup diğeriyle boncuğu geçirsin.', 'Renk sırasıyla örüntü yapın: kırmızı, mavi, kırmızı.', 'Kolye ya da bileklik olarak tamamlayın.'],
    tip: 'Başlangıçta pipet parçaları daha kolaydır.',
    smallParts: true, seated: true,
  },
  {
    id: 'masa', area: 'fineMotor', title: 'Maşayla Ponpon Taşıma',
    goal: 'Elin açılıp kapanmasını ve göz-el koordinasyonunu geliştirir.',
    materials: 'Mutfak maşası ya da büyük cımbız, ponponlar, iki kase',
    steps: ['Ponponları bir kaseye koyun.', 'Maşayla tek tek diğer kaseye taşısın.', 'Renklere göre ayırarak zorlaştırın.', 'Kaç tane taşıdığını birlikte sayın.'],
    tip: 'Maşayı baş parmağı yukarıda tutmasını hatırlatın.',
    smallParts: true, seated: true,
  },
  // Kaba motor ve denge
  {
    id: 'cizgi', area: 'grossMotor', title: 'Çizgi Üzerinde Yürüme',
    goal: 'Dengeyi ve vücut kontrolünü geliştirir.',
    materials: 'Kağıt bant',
    steps: ['Yere 2-3 metrelik düz bir bant çizgisi yapıştırın.', 'Önce normal, sonra topuk-burun yürüsün.', 'Kolları yana açık, ip cambazı gibi yürüyebilir.', 'Geri geri yürüyerek zorlaştırın.'],
    tip: 'Düşme korkusu varsa elinden tutarak başlayın.',
    effort: true,
  },
  {
    id: 'hayvan', area: 'grossMotor', title: 'Hayvan Yürüyüşleri',
    goal: 'Kas gücünü, vücut farkındalığını ve koordinasyonu artırır.',
    materials: 'Boş bir alan',
    steps: ['Ayı yürüyüşü: eller ve ayaklar yerde, dizler düz.', 'Yengeç yürüyüşü: yüz yukarı, kalça havada.', 'Tavşan zıplaması: iki ayak birlikte.', 'Her hayvanla odanın bir ucundan diğerine gidin.'],
    tip: 'Hayvan seslerini eklemek oyunu daha eğlenceli yapar.',
    effort: true,
  },
  {
    id: 'top', area: 'grossMotor', title: 'Top Atma ve Yakalama',
    goal: 'Göz-el koordinasyonunu ve zamanlamayı geliştirir.',
    materials: 'Büyük yumuşak top, sonra daha küçük bir top',
    steps: ['1-2 metre mesafeden büyük topla başlayın.', 'Atmadan önce "hazır" deyip kollarını açmasını isteyin.', 'Başardıkça mesafeyi artırın, topu küçültün.', 'Duvara atıp yakalayarak tek başına da çalışabilir.'],
    tip: 'Balon yavaş düştüğü için harika bir başlangıçtır.',
  },
  {
    id: 'parkur', area: 'grossMotor', title: 'Ev İçi Engel Parkuru',
    goal: 'Motor planlamayı, dengeyi ve kas gücünü geliştirir.',
    materials: 'Yastıklar, sandalye, masa, battaniye',
    steps: ['Yastıklardan basamak, masanın altından tünel kurun.', 'Parkuru önce siz gösterin.', 'Çocuğunuz sırayla engellerden geçsin.', 'Her turda bir engeli değiştirin.'],
    tip: 'Parkuru birlikte kurmak da planlama becerisini çalıştırır.',
    effort: true,
  },
  // İki el koordinasyonu
  {
    id: 'yirtma', area: 'bilateral', title: 'Kağıt Yırtma Kolajı',
    goal: 'İki elin farklı görevlerde birlikte çalışmasını sağlar.',
    materials: 'Renkli kağıt ya da dergi sayfası, yapıştırıcı, karton',
    steps: ['Kağıdı iki elinin parmak uçlarıyla tutsun.', 'Bir eli kendine, diğeri ileri çekerek yırtsın.', 'Parçaları bir resmin içine yapıştırın.', 'Bitmiş kolajı duvara asın.'],
    tip: 'Önce ince şeritler hazırlarsanız yırtmak kolaylaşır.',
    seated: true,
  },
  {
    id: 'kavanoz', area: 'bilateral', title: 'Kavanoz Açma-Kapama',
    goal: 'Bilek dönüşünü ve iki elin uyumunu geliştirir.',
    materials: 'Farklı boyda plastik kavanozlar ve kapakları',
    steps: ['Kavanozların içine küçük sürprizler koyun.', 'Bir eliyle kavanozu tutup diğeriyle kapağı çevirsin.', 'Kapakları karıştırın, doğru kapağı bulsun.', 'Kapakları sıkıca kapatarak bitirsin.'],
    tip: 'Büyük kapaklarla başlamak daha kolaydır.',
    seated: true,
  },
  {
    id: 'kesme', area: 'bilateral', title: 'Makasla Kesme',
    goal: 'Makas becerisini ve iki elin uyumlu çalışmasını geliştirir.',
    materials: 'Çocuk makası, kalın çizgili kağıtlar',
    steps: ['Makası baş parmağı yukarıda tutmasını gösterin.', 'Önce kağıdın kenarına küçük kesikler yapsın.', 'Sonra düz, ardından kıvrımlı çizgi boyunca kessin.', 'Kağıdı tutan eliyle kağıdı çevirerek yardım etsin.'],
    tip: 'Kalın kağıt ince kağıttan daha kolay kesilir.',
    seated: true, tool: true,
  },
  {
    id: 'ritim', area: 'bilateral', title: 'Ritim Tutma',
    goal: 'İki elin sırayla ve birlikte çalışmasını, ritim duygusunu geliştirir.',
    materials: 'Ters çevrilmiş tencere, iki tahta kaşık',
    steps: ['İki elle birlikte vurun.', 'Sırayla sağ ve sol elle vurun.', 'Sizin yaptığınız ritmi taklit etsin.', 'Sevdiği bir şarkıya eşlik edin.'],
    tip: 'Sesten rahatsız olursa yastığa vurarak oynayın.',
    noisy: true,
  },
  // Duyusal düzenleme
  {
    id: 'duyu', area: 'sensory', title: 'Duyu Kutusu',
    goal: 'Dokunsal algıyı geliştirir ve farklı dokulara alışmayı sağlar.',
    materials: 'Geniş kutu, pirinç ya da kuru nohut, küçük oyuncaklar',
    steps: ['Kutuyu pirinçle doldurup oyuncakları saklayın.', 'Elleriyle karıştırarak oyuncakları bulsun.', 'Gözleri kapalıyken bulduğu oyuncağı tahmin etsin.', 'Bardakla doldurup boşaltarak oyuna devam edin.'],
    tip: 'Dökülenler için altına bir örtü serin.',
    messy: true, smallParts: true, seated: true,
  },
  {
    id: 'agir', area: 'sensory', title: 'Ağır İş Görevleri',
    goal: 'Kaslara ve eklemlere yoğun girdi vererek sakinleşmeye yardım eder.',
    materials: 'Çamaşır sepeti, kitaplar, duvar',
    steps: ['Kitap dolu sepeti odadan odaya taşısın.', 'Duvarı iki eliyle 10 saniye itsin.', 'Market poşetlerini taşımaya yardım etsin.', 'Bitince birlikte derin nefes alın.'],
    tip: 'Huzursuz ya da çok hareketli olduğu anlarda iyi gelir.',
    effort: true,
  },
  {
    id: 'sandvic', area: 'sensory', title: 'Yastık Sandviçi',
    goal: 'Derin basınçla sakinleşmeye ve vücut farkındalığına yardım eder.',
    materials: 'İki büyük yastık ya da minder',
    steps: ['Çocuğunuz bir yastığın üzerine yüzüstü uzansın.', 'Diğer yastığı üstüne koyup sandviç yapın.', 'Yastığın üzerinden hafifçe ve eşit bastırın.', 'Ne kadar bastırmanızı istediğini ona sorun.'],
    tip: 'Başı ve yüzü her zaman açıkta kalsın; istemezse hemen bırakın.',
  },
  {
    id: 'nefes', area: 'sensory', title: 'Balon Nefesi',
    goal: 'Nefesini düzenlemeyi ve sakinleşmeyi öğretir.',
    materials: 'Pipet, pinpon topu (isteğe bağlı)',
    steps: ['Burnundan derin nefes alıp karnını balon gibi şişirsin.', 'Ağzından yavaşça balonu söndürsün.', '5 kez tekrarlayın.', 'Pipetle pinpon topunu masada üfleyerek yarışın.'],
    tip: 'Yatmadan önce yapmak uykuya geçişi kolaylaştırır.',
  },
  // Görsel algı
  {
    id: 'sekil', area: 'visual', title: 'Şekil Eşleştirme',
    goal: 'Şekil algısını ve görsel ayırt etmeyi geliştirir.',
    materials: 'Kartondan kesilmiş şekiller, şekillerin çizildiği kağıt',
    steps: ['Daire, kare, üçgen ve yıldız kesin.', 'Kağıda aynı şekillerin dış çizgilerini çizin.', 'Her şekli doğru yerine yerleştirsin.', 'Şekilleri döndürerek zorlaştırın.'],
    tip: 'Önce 2-3 şekille başlayın.',
    seated: true,
  },
  {
    id: 'labirent', area: 'visual', title: 'Labirent',
    goal: 'Görsel takibi ve kalem kontrolünü geliştirir.',
    materials: 'Basit labirent çıktısı, kalın kalem',
    steps: ['Önce yolu parmağıyla bulsun.', 'Sonra kalemle çizgilere değmeden ilerlesin.', 'Bitişe bir çıkartma koyun.', 'Geniş yollardan dar yollara geçin.'],
    tip: 'Yolları renkli kalemle belirginleştirebilirsiniz.',
    seated: true, tool: true,
  },
  {
    id: 'gizli', area: 'visual', title: 'Saklı Nesneyi Bul',
    goal: 'Görsel dikkati ve şekli zeminden ayırt etmeyi geliştirir.',
    materials: 'Kalabalık resimli bir kitap ya da dergi',
    steps: ['Resimde bulacağı nesneyi söyleyin.', 'Parmağıyla göstersin.', 'Bulduklarını birlikte sayın.', 'Sıra ona gelsin, size nesne sorsun.'],
    tip: 'Az ayrıntılı resimlerle başlayın.',
    seated: true,
  },
  {
    id: 'blok', area: 'visual', title: 'Blokla Model Kopyalama',
    goal: 'Görsel-uzamsal algıyı ve planlamayı geliştirir.',
    materials: 'Lego ya da tahta bloklar',
    steps: ['3-4 bloktan bir kule ya da köprü yapın.', 'Aynısını yanına yapmasını isteyin.', 'Renk ve sırayı birlikte kontrol edin.', 'Resimden kopyalayarak zorlaştırın.'],
    tip: 'Başardıkça blok sayısını artırın.',
    seated: true,
  },
  // Öz bakım
  {
    id: 'dugme', area: 'selfCare', title: 'Düğme İlikleme',
    goal: 'Giyinmede bağımsızlığı ve parmak becerisini geliştirir.',
    materials: 'Büyük düğmeli eski bir gömlek ya da hırka',
    steps: ['Önce masada büyük düğmelerle çalışın.', 'Bir eliyle iliği açıp diğeriyle düğmeyi itsin.', 'Alttan yukarı doğru iliklesin.', 'Sonra üzerindeyken denesin.'],
    tip: 'Aynanın karşısında çalışmak yardımcı olur.',
    seated: true,
  },
  {
    id: 'giyinme', area: 'selfCare', title: 'Resimli Giyinme Sırası',
    goal: 'Giyinme adımlarını sıralamayı ve bağımsızlığı destekler.',
    materials: 'Giyinme adımlarının resimli kartları, kıyafetler',
    steps: ['Kıyafetleri giyme sırasına göre dizin.', 'Resimli kartları sırayla takip etsin.', 'Takıldığı adımda yalnızca o adıma yardım edin.', 'Her gün bir adımı daha kendisi yapsın.'],
    tip: 'Oturarak giyinmek dengeyi kolaylaştırır.',
  },
  {
    id: 'dis', area: 'selfCare', title: 'Diş Fırçalama Rutini',
    goal: 'Öz bakım rutinini ve ağız içi duyusal kabulü destekler.',
    materials: 'Çocuk diş fırçası, macun, iki dakikalık bir şarkı',
    steps: ['Ayna karşısında yan yana fırçalayın.', 'Önce üst, sonra alt dişler; içleri ve dışları.', 'Şarkı bitene kadar devam etsin.', 'Bitince birlikte gülümseyip kontrol edin.'],
    tip: 'Fırça rahatsız ediyorsa daha yumuşak bir fırça deneyin.',
  },
  {
    id: 'kasik', area: 'selfCare', title: 'Kaşıkla Taşıma',
    goal: 'Yemek yeme becerisini ve el kontrolünü geliştirir.',
    materials: 'Kaşık, iki kase, kuru fasulye ya da makarna',
    steps: ['Bir kaseyi doldurun, diğerini yanına koyun.', 'Kaşıkla dökmeden diğer kaseye taşısın.', 'Kaşığı doğru tutmasını hatırlatın.', 'Suyla taşıyarak zorlaştırın.'],
    tip: 'Dökülmesi normaldir; altına bir tepsi koyun.',
    smallParts: true, seated: true,
  },
  // Dikkat ve masa başı
  {
    id: 'trafik', area: 'attention', title: 'Kırmızı Işık, Yeşil Işık',
    goal: 'Durup başlamayı ve öz denetimi geliştirir.',
    materials: 'Kırmızı, sarı ve yeşil kart',
    steps: ['Yeşil kartta yürüsün ya da dans etsin.', 'Kırmızı kartta heykel gibi dursun.', 'Sarı kartta yavaş hareket etsin.', 'Sırayla yönetici olun.'],
    tip: 'Müzikle oynamak oyunu daha eğlenceli yapar.',
  },
  {
    id: 'yonerge', area: 'attention', title: 'Sıralı Yönerge Oyunu',
    goal: 'Dinlemeyi, hafızayı ve sıralamayı geliştirir.',
    materials: 'Evdeki günlük eşyalar',
    steps: ['Tek adımlı yönergeyle başlayın: "Topu getir."', 'İki adıma geçin: "Topu getir, sepete koy."', 'Üç adıma çıkın.', 'Sıra ona gelsin, size yönerge versin.'],
    tip: 'Yönergeyi bir kez söyleyin, gerekirse resimle destekleyin.',
  },
  {
    id: 'kumsaati', area: 'attention', title: 'Kum Saatiyle Masa Başı',
    goal: 'Masa başında kalma süresini ve görevi bitirmeyi artırır.',
    materials: 'Kum saati (1-3 dakika), sevdiği bir masa etkinliği',
    steps: ['Kum saatini birlikte çevirin.', 'Kum bitene kadar etkinliğe devam etsin.', 'Bitince kısa bir mola ya da hareket verin.', 'Her hafta süreyi biraz uzatın.'],
    tip: 'Telefonun zamanlayıcısı da kullanılabilir.',
    seated: true,
  },
  {
    id: 'hafiza', area: 'attention', title: 'Hafıza Kartları',
    goal: 'Görsel hafızayı ve dikkati geliştirir.',
    materials: 'Eş resimli kartlar (6-12 çift)',
    steps: ['Kartları ters çevirip dizin.', 'Sırayla ikişer kart açın.', 'Eşini bulan kartları alır.', 'Az kartla başlayıp çoğaltın.'],
    tip: 'Sevdiği karakterlerin resimleri isteğini artırır.',
    seated: true,
  },
  // Yazı öncesi
  {
    id: 'tuz', area: 'prewriting', title: 'Tuz Tepsisinde Çizim',
    goal: 'Yazı öncesi çizgileri dokunarak öğretir.',
    materials: 'Tepsi, tuz ya da irmik',
    steps: ['Tepsiye ince bir tuz tabakası serin.', 'İşaret parmağıyla dik, yatay ve yuvarlak çizgiler çizsin.', 'Tepsiyi sallayıp silerek tekrar çizsin.', 'Şekil ve harflerle devam edin.'],
    tip: 'Tepsinin altına renkli kağıt koyarsanız çizgiler belirgin görünür.',
    messy: true, seated: true,
  },
  {
    id: 'dikey', area: 'prewriting', title: 'Dik Yüzeyde Boyama',
    goal: 'Bilek ve omuz kontrolünü, doğru kalem tutuşunu destekler.',
    materials: 'Duvara bantlanmış kağıt, kalın boya kalemleri',
    steps: ['Kağıdı göz hizasında duvara bantlayın.', 'Ayakta büyük daireler ve çizgiler çizsin.', 'Resmin içini boyasın.', 'Kağıdı küçülterek hassasiyeti artırın.'],
    tip: 'Dik yüzey bileği doğru açıda tutmasına yardım eder.',
    tool: true,
  },
  {
    id: 'nokta', area: 'prewriting', title: 'Nokta Birleştirme',
    goal: 'Kalem kontrolünü ve görsel takibi geliştirir.',
    materials: 'Nokta birleştirme sayfaları, kalem',
    steps: ['Az noktalı basit şekillerle başlayın.', 'Noktaları sırayla birleştirsin.', 'Ortaya çıkan resmi boyasın.', 'Nokta sayısını artırarak ilerleyin.'],
    tip: 'Sayıları bilmiyorsa renklerle sıralama yapın.',
    seated: true, tool: true,
  },
  {
    id: 'kisaboya', area: 'prewriting', title: 'Kısa Boyayla Boyama',
    goal: 'Üç parmakla doğru kalem tutuşunu destekler.',
    materials: 'Kırılmış kısa mum boyalar, boyama sayfası',
    steps: ['Mum boyaları 2-3 cm boyunda kırın.', 'Kısa boyayı üç parmağıyla tutsun.', 'Boyama sayfasını çizgilerin içinde kalarak boyasın.', 'Sonra normal kalemle aynı tutuşu denesin.'],
    tip: 'Tutuşu sözle değil, oyunla düzeltin.',
    smallParts: true, seated: true, tool: true,
  },
];

export function activityById(id) {
  return ACTIVITIES.find((a) => a.id === id);
}

export function areaLabel(id) {
  return AREAS.find((a) => a.id === id)?.label ?? '';
}

// Activities in the chosen areas, in library order.
export function activitiesFor(areaIds) {
  return ACTIVITIES.filter((a) => areaIds.includes(a.area));
}

// General tips for the top of the PDF, one per chosen flag.
export function tipsFor(flagIds) {
  return FLAGS.filter((f) => flagIds.includes(f.id)).map((f) => ({ label: f.label, text: f.tip }));
}

// Tips for one activity, from the child's flags that apply to it.
export function adaptationsFor(activity, flagIds) {
  return FLAGS
    .filter((f) => flagIds.includes(f.id) && f.when && (f.when === 'all' || activity[f.when]))
    .map((f) => ({ label: f.label, text: f.adapt }));
}
