import type { SupportedLocale } from '@/lib/i18n/config'

/** One bullet of the fullscreen explanation: an emphasized action + its detail.
 *  Rendered as "<b>{lead}</b> — {rest}". "PopOut" / "Chrome" are product names
 *  and stay untranslated across locales. */
export interface FullscreenBullet {
  readonly lead: string
  readonly rest: string
}

export interface FullscreenSaveCopy {
  readonly heading: string
  readonly intro: string
  readonly bullets: readonly [FullscreenBullet, FullscreenBullet, FullscreenBullet]
  readonly tagNote: string
}

/**
 * Copy for the one-time "you're in fullscreen" card shown when macOS Chrome
 * opens the /save popup as a full tab. /save is NOT wrapped in I18nProvider
 * (its layout only propagates the theme), so this is a self-contained map keyed
 * by the board's stored locale — same pattern as onboarding/backup copy. The 13
 * non-en/ja locales are a Claude first pass and need native review before wide
 * launch (see docs/CURRENT_GOAL.md pre-launch gate).
 */
const COPY: Record<SupportedLocale, FullscreenSaveCopy> = {
  en: {
    heading: "You're in fullscreen",
    intro: 'Chrome is in fullscreen, so saving opens this tab each time. To avoid it:',
    bullets: [
      { lead: 'Exit fullscreen', rest: 'saves show in a small corner window instead.' },
      { lead: 'Keep PopOut open', rest: 'the save appears there and this tab closes instantly.' },
      { lead: 'Install the extension', rest: 'saves silently, with no window at all.' },
    ],
    tagNote: "Tagging isn't available on fullscreen bookmarklet saves — you can add tags later on your board.",
  },
  ja: {
    heading: 'フルスクリーン表示中です',
    intro: 'Chrome がフルスクリーンのため、保存するたびにこのタブが開きます。避けるには：',
    bullets: [
      { lead: 'フルスクリーンを解除', rest: '右下の小さな窓で保存されます。' },
      { lead: 'PopOut を開いておく', rest: '保存の確認はそちらに出て、このタブはすぐ閉じます。' },
      { lead: '拡張機能を入れる', rest: '窓を開かずに静かに保存できます。' },
    ],
    tagNote: 'フルスクリーンのブックマークレット保存ではタグ付けできません。あとでボードで付けられます。',
  },
  zh: {
    heading: '你正处于全屏模式',
    intro: 'Chrome 处于全屏，所以每次保存都会打开此标签页。要避免：',
    bullets: [
      { lead: '退出全屏', rest: '保存会改在右下角的小窗口中显示。' },
      { lead: '保持 PopOut 打开', rest: '保存会显示在那里，此标签页会立即关闭。' },
      { lead: '安装扩展程序', rest: '静默保存，完全不打开窗口。' },
    ],
    tagNote: '全屏下的书签保存无法加标签 — 你可以稍后在看板中添加。',
  },
  ko: {
    heading: '전체 화면 모드입니다',
    intro: 'Chrome가 전체 화면이라 저장할 때마다 이 탭이 열립니다. 피하려면:',
    bullets: [
      { lead: '전체 화면 해제', rest: '저장이 오른쪽 아래 작은 창에 표시됩니다.' },
      { lead: 'PopOut 열어 두기', rest: '저장이 거기에 표시되고 이 탭은 즉시 닫힙니다.' },
      { lead: '확장 프로그램 설치', rest: '창 없이 조용히 저장됩니다.' },
    ],
    tagNote: '전체 화면 북마클릿 저장에서는 태그를 달 수 없습니다 — 나중에 보드에서 추가할 수 있습니다.',
  },
  es: {
    heading: 'Estás en pantalla completa',
    intro: 'Chrome está en pantalla completa, así que guardar abre esta pestaña cada vez. Para evitarlo:',
    bullets: [
      { lead: 'Salir de pantalla completa', rest: 'el guardado se muestra en una pequeña ventana en la esquina.' },
      { lead: 'Mantén PopOut abierto', rest: 'el guardado aparece ahí y esta pestaña se cierra al instante.' },
      { lead: 'Instala la extensión', rest: 'guarda en silencio, sin abrir ninguna ventana.' },
    ],
    tagNote: 'No se pueden añadir etiquetas al guardar con el marcador en pantalla completa — puedes añadirlas después en tu tablero.',
  },
  fr: {
    heading: 'Vous êtes en plein écran',
    intro: "Chrome est en plein écran, donc l'enregistrement ouvre cet onglet à chaque fois. Pour l'éviter :",
    bullets: [
      { lead: 'Quitter le plein écran', rest: "l'enregistrement s'affiche dans une petite fenêtre dans le coin." },
      { lead: 'Gardez PopOut ouvert', rest: "l'enregistrement y apparaît et cet onglet se ferme aussitôt." },
      { lead: "Installez l'extension", rest: 'enregistre en silence, sans aucune fenêtre.' },
    ],
    tagNote: "L'ajout de tags n'est pas disponible lors d'un enregistrement en plein écran — vous pourrez les ajouter plus tard sur votre tableau.",
  },
  de: {
    heading: 'Sie sind im Vollbildmodus',
    intro: 'Chrome ist im Vollbild, daher öffnet das Speichern jedes Mal diesen Tab. Um das zu vermeiden:',
    bullets: [
      { lead: 'Vollbild verlassen', rest: 'das Speichern erscheint stattdessen in einem kleinen Eckfenster.' },
      { lead: 'PopOut geöffnet lassen', rest: 'das Speichern erscheint dort und dieser Tab schließt sich sofort.' },
      { lead: 'Erweiterung installieren', rest: 'speichert lautlos, ganz ohne Fenster.' },
    ],
    tagNote: 'Beim Speichern per Bookmarklet im Vollbild sind keine Tags möglich — du kannst sie später auf deinem Board hinzufügen.',
  },
  pt: {
    heading: 'Você está em tela cheia',
    intro: 'O Chrome está em tela cheia, então salvar abre esta aba a cada vez. Para evitar:',
    bullets: [
      { lead: 'Sair da tela cheia', rest: 'o salvamento aparece em uma pequena janela no canto.' },
      { lead: 'Mantenha o PopOut aberto', rest: 'o salvamento aparece lá e esta aba fecha na hora.' },
      { lead: 'Instale a extensão', rest: 'salva silenciosamente, sem nenhuma janela.' },
    ],
    tagNote: 'Não é possível adicionar tags ao salvar pelo bookmarklet em tela cheia — você pode adicioná-las depois no seu quadro.',
  },
  it: {
    heading: 'Sei in modalità schermo intero',
    intro: 'Chrome è a schermo intero, quindi il salvataggio apre questa scheda ogni volta. Per evitarlo:',
    bullets: [
      { lead: 'Esci dallo schermo intero', rest: 'il salvataggio appare invece in una piccola finestra nell’angolo.' },
      { lead: 'Tieni PopOut aperto', rest: 'il salvataggio appare lì e questa scheda si chiude subito.' },
      { lead: "Installa l'estensione", rest: 'salva in silenzio, senza alcuna finestra.' },
    ],
    tagNote: 'Non è possibile aggiungere tag durante il salvataggio con il bookmarklet a schermo intero — puoi aggiungerli più tardi nella tua bacheca.',
  },
  nl: {
    heading: 'Je bent in volledig scherm',
    intro: 'Chrome staat in volledig scherm, dus opslaan opent elke keer dit tabblad. Om dit te voorkomen:',
    bullets: [
      { lead: 'Volledig scherm verlaten', rest: 'opslaan verschijnt in plaats daarvan in een klein venster in de hoek.' },
      { lead: 'Houd PopOut open', rest: 'het opslaan verschijnt daar en dit tabblad sluit meteen.' },
      { lead: 'Installeer de extensie', rest: 'slaat stil op, zonder enig venster.' },
    ],
    tagNote: 'Tags toevoegen kan niet bij opslaan via de bookmarklet in volledig scherm — je kunt ze later op je board toevoegen.',
  },
  tr: {
    heading: 'Tam ekrandasınız',
    intro: 'Chrome tam ekran olduğu için kaydetme her seferinde bu sekmeyi açar. Bunu önlemek için:',
    bullets: [
      { lead: 'Tam ekrandan çık', rest: 'kaydetme bunun yerine köşede küçük bir pencerede görünür.' },
      { lead: "PopOut'u açık tut", rest: 'kaydetme orada görünür ve bu sekme hemen kapanır.' },
      { lead: 'Uzantıyı yükle', rest: 'hiç pencere açmadan sessizce kaydeder.' },
    ],
    tagNote: 'Tam ekran yer imi kaydetmelerinde etiketleme kullanılamaz — bunları daha sonra panonuzda ekleyebilirsiniz.',
  },
  ru: {
    heading: 'Вы в полноэкранном режиме',
    intro: 'Chrome в полноэкранном режиме, поэтому сохранение каждый раз открывает эту вкладку. Чтобы этого избежать:',
    bullets: [
      { lead: 'Выйдите из полноэкранного режима', rest: 'сохранение появится в небольшом окне в углу.' },
      { lead: 'Держите PopOut открытым', rest: 'сохранение появится там, а эта вкладка сразу закроется.' },
      { lead: 'Установите расширение', rest: 'сохраняет тихо, без единого окна.' },
    ],
    tagNote: 'При сохранении через букмарклет в полноэкранном режиме теги недоступны — вы можете добавить их позже на доске.',
  },
  ar: {
    heading: 'أنت في وضع ملء الشاشة',
    intro: 'Chrome في وضع ملء الشاشة، لذا يفتح الحفظ هذه العلامة في كل مرة. لتجنّب ذلك:',
    bullets: [
      { lead: 'اخرج من ملء الشاشة', rest: 'سيظهر الحفظ في نافذة صغيرة في الزاوية بدلاً من ذلك.' },
      { lead: 'أبقِ PopOut مفتوحًا', rest: 'يظهر الحفظ هناك وتُغلق هذه العلامة فورًا.' },
      { lead: 'ثبّت الإضافة', rest: 'يحفظ بصمت دون أي نافذة.' },
    ],
    tagNote: 'لا تتوفر الوسوم عند الحفظ عبر أداة الإشارة في ملء الشاشة — يمكنك إضافتها لاحقًا على لوحتك.',
  },
  th: {
    heading: 'คุณกำลังอยู่ในโหมดเต็มจอ',
    intro: 'Chrome อยู่ในโหมดเต็มจอ การบันทึกจึงเปิดแท็บนี้ทุกครั้ง วิธีเลี่ยง:',
    bullets: [
      { lead: 'ออกจากโหมดเต็มจอ', rest: 'การบันทึกจะแสดงในหน้าต่างเล็กที่มุมจอแทน' },
      { lead: 'เปิด PopOut ไว้', rest: 'การบันทึกจะแสดงที่นั่นและแท็บนี้จะปิดทันที' },
      { lead: 'ติดตั้งส่วนขยาย', rest: 'บันทึกแบบเงียบ ๆ โดยไม่เปิดหน้าต่างเลย' },
    ],
    tagNote: 'การบันทึกด้วยบุ๊กมาร์กเล็ตในโหมดเต็มจอไม่สามารถติดแท็กได้ — คุณเพิ่มแท็กภายหลังได้ที่บอร์ด',
  },
  vi: {
    heading: 'Bạn đang ở chế độ toàn màn hình',
    intro: 'Chrome đang ở toàn màn hình, nên mỗi lần lưu sẽ mở tab này. Để tránh:',
    bullets: [
      { lead: 'Thoát toàn màn hình', rest: 'thay vào đó việc lưu hiển thị trong một cửa sổ nhỏ ở góc.' },
      { lead: 'Giữ PopOut mở', rest: 'việc lưu hiển thị ở đó và tab này đóng ngay.' },
      { lead: 'Cài tiện ích mở rộng', rest: 'lưu âm thầm, không mở cửa sổ nào.' },
    ],
    tagNote: 'Không thể gắn thẻ khi lưu bằng bookmarklet ở chế độ toàn màn hình — bạn có thể thêm thẻ sau trên bảng của mình.',
  },
}

/** Fullscreen explanation copy for a locale, falling back to English. */
export function getFullscreenSaveCopy(locale: SupportedLocale): FullscreenSaveCopy {
  return COPY[locale] ?? COPY.en
}
