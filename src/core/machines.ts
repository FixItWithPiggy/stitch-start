// The machine library. Each profile is a "fact sheet" built from the
// manufacturer's manual and support pages. To add a machine, copy one of these
// objects, fill in every field from the official manual, and add it to MACHINES.

import type { Machine } from './types';

const POOLIN_THREAD =
  'https://www.poolin.eu/blogs/inspiration/how-to-thread-a-poolin-eoc03-or-eoc05-embroidery-m/';
const POOLIN_MANUAL = 'https://www.manualslib.com/manual/4007932/Poolin-Eoc05.html';
const HOOPING =
  'https://hoopingstation.com/blogs/articles/your-first-stitch-on-the-poolin-eoc05-threading-hooping-usb-designs-and-the-beginner-mistakes-that-waste-hours';
const BROTHER_FAQ =
  'https://support.brother.com/g/b/faqend.aspx?c=us&lang=en&prod=hf_cs7000xeus&faqid=';

export const POOLIN_EOC05: Machine = {
  id: 'poolin-eoc05',
  brand: 'Poolin',
  model: 'EOC05',
  aliases: ['eoc05', 'eoc5'],
  type: 'embroidery',
  typeLabel: 'Embroidery machine',
  has: ['Tension (on screen, 1–6)', 'Hoop and design placement', 'Speed (up to 700 spm)'],
  hasNot: ['Stitch length', 'Stitch width'],
  hasNotWhy: 'Your design file sets these, so the app never asks.',
  specs: [
    ['Hoops', '4″ × 4″ and 4″ × 9.25″'],
    ['Tension', '1–6, on the touchscreen'],
    ['Max speed', '700 stitches/min'],
    ['Files', 'DST, DSB'],
    ['Fabric', 'Up to 4 mm thick'],
    ['Needle supplied', '90/14'],
  ],
  tensionRange: '1–6',
  hoops: [
    { label: '4″ × 4″', w: 4, h: 4 },
    { label: '4″ × 9.25″', w: 4, h: 9.25 },
  ],
  formats: ['dst', 'dsb'],
  flatbedOnly: true,
  maxThicknessMm: 4,
  maxSpeedSpm: 700,
  status: 'checked',
  checkedNote:
    'Specs checked Oct 2026 against Poolin retailer listings, Poolin Europe and the operation manual. Confirm against your printed manual.',
  sources: [
    {
      label: 'Swing Design EOC05 listing',
      url: 'https://www.swingdesign.com/products/poolin-eoc05-4in-x-9-2in-embroidery-machine-with-embroidery-accessory-kit',
    },
    { label: 'EOC05 manual summary', url: 'https://manuals.plus/asin/B0BZC8ZSWC' },
    { label: 'Poolin EOC05 operation manual', url: POOLIN_MANUAL },
  ],
  guides: [
    {
      key: 'top',
      tab: 'Top thread',
      title: 'Thread the top thread',
      steps: [
        { group: 'Thread path' },
        '**Raise the presser foot.** This opens the tension discs so the thread can drop between them.',
        "Put the spool on the spool holder with a spool cap so it doesn't wobble. If you use a thread stand, set it a little higher than the machine.",
        'Pull the thread through the **metal hook** at the top of the machine.',
        'Pull it down past the white plastic cover so it sits **between the two metal tension discs**, not beside them.',
        'Bring the thread under the plastic lip and down.',
        'Follow the **orange guide**: down the right side, around the bottom corner, and back up the left side.',
        '**Lower the presser foot** now that the thread is seated.',
        "At the top of the orange guide, make a U-turn from right to left to catch the **take-up lever**. If it won't catch, slide the thread along the outside of the curve until it hooks inside the slit.",
        'Bring the thread down the left side toward the needle and through the **small guide just above the needle clamp**. Skipping this guide is a common cause of shredded thread.',
        { group: 'Thread the needle' },
        'Press the **needle position button** until the needle is at its highest point.',
        'Catch the thread on the small hook on the left side of the foot.',
        'Press the **threader handle** down so its hook goes through the needle eye.',
        'Pass the thread in front of the needle through the two forks, then release the handle.',
        'Pull the loop all the way through the eye, then trim the tail with the cutter on the left side of the machine.',
      ],
      tips: [
        'Floss test: pull the thread near the needle. It should feel like gentle dental floss. If it slides with no resistance, it missed the tension discs, so rethread with the foot up.',
        'Use polyester embroidery thread on top.',
      ],
      sources: [
        { label: 'Poolin Europe threading guide', url: POOLIN_THREAD },
        { label: 'Hooping Station EOC05 guide', url: HOOPING },
      ],
    },
    {
      key: 'wind',
      tab: 'Wind a bobbin',
      title: 'Wind a bobbin',
      steps: [
        'Put the spool on the spool pin and add the spool cap.',
        'Put an empty bobbin on the **bobbin winder shaft**, lining up the notch in the bobbin with the spring on the shaft.',
        'Turn on the machine.',
        'Pull thread from the spool, under the thread guide hook, and through the slit in the winder seat.',
        'Wind the thread **clockwise** around the bobbin 5 or 6 times by hand.',
        'Press **Start**. The machine winds the bobbin.',
        'When it stops, cut the thread, slide the winder back to the left, and take off the bobbin.',
      ],
      tips: [
        'Use thin 60 wt or 90 wt bobbin thread. Thick bobbin thread causes tension trouble.',
        'Many embroiderers skip winding and use pre-wound bobbins.',
        "Order taken from Poolin's operation manual, pp. 26–28. Check the pictures there for the exact thread guide.",
      ],
      sources: [{ label: 'Poolin EOC05 operation manual', url: POOLIN_MANUAL }],
    },
    {
      key: 'insert',
      tab: 'Insert the bobbin',
      title: 'Insert the bobbin',
      steps: [
        'Slide the bobbin cover latch to the right and lift off the clear cover.',
        'Hold the bobbin so the thread hangs off the left side and the bobbin looks like the letter **"P"**. If it looks like a "q", flip it over.',
        "Drop it into the case. Rest a fingertip on it so it doesn't spin.",
        'With your other hand, pull the thread through the slit and around toward the cutter.',
        'Feel for a small **click** as the thread slips under the tension spring. No click means no bobbin tension.',
        'Tug the tail. The bobbin should turn **counterclockwise**. If it turns clockwise, take it out and flip it.',
        'Put the cover back: the tab goes into the left slot first, then press the right side down.',
      ],
      tips: [
        'Loops on the back of your design often come from a bobbin that turns the wrong way or skipped the tension spring.',
      ],
      sources: [
        { label: 'Hooping Station EOC05 guide', url: HOOPING },
        { label: 'Poolin EOC05 operation manual (pp. 24–25)', url: POOLIN_MANUAL },
      ],
    },
    {
      key: 'needle',
      tab: 'Change the needle',
      title: 'Change the needle',
      steps: [
        'Press the needle position button to raise the needle to its highest point.',
        '**Turn off the machine.**',
        "Cover the hole in the needle plate with a scrap of paper or cloth so the needle can't fall in.",
        'Loosen the needle clamp screw by turning it **counterclockwise**, and pull out the old needle.',
        'Slide in the new needle with the **flat side facing the back**. Push it up until it stops.',
        'Tighten the needle clamp screw.',
      ],
      tips: [
        "Change the needle about every 8 hours of stitching, or sooner if it's bent, dull, or thread keeps breaking.",
        'Use embroidery needles: 75/11 for light fabrics, 90/14 for heavier ones.',
      ],
      sources: [
        { label: 'Poolin EOC05 operation manual (pp. 29–30)', url: POOLIN_MANUAL },
        { label: 'Hooping Station EOC05 guide', url: HOOPING },
      ],
    },
  ],
};

export const BROTHER_CS7000X: Machine = {
  id: 'brother-cs7000x',
  brand: 'Brother',
  model: 'CS7000X',
  aliases: ['cs7000x', 'cs7000'],
  type: 'sewing',
  typeLabel: 'Sewing machine',
  has: ['Tension dial (0–9)', 'Stitch length (up to 5 mm)', 'Stitch width (up to 7 mm)'],
  hasNot: ['Embroidery hoop'],
  hasNotWhy: "This machine sews seams and decorative stitches, not hooped embroidery.",
  specs: [
    ['Tension', 'Dial 0–9, default 4'],
    ['Stitch length', '0–5 mm'],
    ['Stitch width', '0–7 mm'],
    ['Bobbin', 'SA156 (Class 15), drop-in'],
    ['Needles', 'Standard home (130/705H)'],
  ],
  tensionRange: '0–9',
  tensionDefault: '4',
  stitchLengthMaxMm: 5,
  stitchWidthMaxMm: 7,
  status: 'sample',
  checkedNote:
    'Threading and bobbin steps come from Brother support pages. Other specs are a sample and still need checking against the Brother manual.',
  sources: [
    { label: 'Brother support: threading', url: BROTHER_FAQ + 'faqh00000467_021' },
    { label: 'Brother support: winding the bobbin', url: BROTHER_FAQ + 'faqh00000438_010' },
    { label: 'Brother support: installing the bobbin', url: BROTHER_FAQ + 'faqh00000580_006' },
  ],
  guides: [
    {
      key: 'top',
      tab: 'Top thread',
      title: 'Thread the top thread',
      steps: [
        { group: 'Get ready' },
        '**Raise the presser foot.**',
        'Turn on the machine and press the **needle position button** once or twice to raise the needle. Then **turn the machine off** before threading.',
        { group: 'Thread path' },
        'Pull the spool pin all the way up and put the spool on it. Check that the thread unwinds the way the picture on the machine shows.',
        'Hold the thread with your right hand and guide it toward you into the groove of the thread guide. Make sure the spring catches it.',
        'Follow the numbered arrows printed on the machine down the channel and back up, then pass the thread through the **take-up lever from right to left**.',
        'Slide the thread behind the **needle bar thread guide** just above the needle.',
        { group: 'Thread the needle' },
        '**Lower the presser foot.**',
        'Pull the needle threader lever all the way down and hook the thread on the guide.',
        'Push the lever back until it stops. Pass the thread in front of the needle so it sits under the little hook that came through the eye.',
        'Let the lever up slowly, then gently pull the loop through the eye.',
        'Raise the presser foot, pass the thread under it, and pull about 4″ toward the back of the machine.',
      ],
      tips: [
        'The threader works with needles 75/11 to 100/16. Thread twin needles and decorative threads by hand.',
        'Never use thread heavier than 20 weight on this machine.',
      ],
      sources: [{ label: 'Brother support: threading the CS7000X', url: BROTHER_FAQ + 'faqh00000467_021' }],
    },
    {
      key: 'wind',
      tab: 'Wind a bobbin',
      title: 'Wind a bobbin',
      steps: [
        'Pull the spool pin all the way up and put the spool on it.',
        'Pass the thread under the thread guide and around the **pretension disk** from front to back. It should run underneath the disk.',
        'Put the bobbin on the winder shaft and slide the shaft to the right so the notch fits.',
        'Wind the thread **clockwise** around the bobbin 5 or 6 times, pass it through the slit in the winder seat, and cut it with the built-in cutter.',
        'Turn on the machine and set the speed slider. Use a slow speed for stretchy thread like clear nylon.',
        'Press **Start/Stop** once (or press the foot pedal) to start winding.',
        'When the bobbin looks full and slows down, press Start/Stop to stop (or lift your foot).',
        'Cut the thread, slide the shaft to the left, and take off the bobbin.',
      ],
      tips: ['Cut the starting tail in the winder-seat slit as shown. A loose tail can tangle while winding.'],
      sources: [{ label: 'Brother support: winding the bobbin', url: BROTHER_FAQ + 'faqh00000438_010' }],
    },
    {
      key: 'insert',
      tab: 'Insert the bobbin',
      title: 'Insert the bobbin',
      steps: [
        'Turn on the machine, press the needle position button to raise the needle, then **turn the machine off**.',
        'Raise the presser foot and open the bobbin cover.',
        'Drop the bobbin in so the thread **feeds to the left**. Keep it facing the same way it sat on the winder.',
        'Hold the thread end and press the bobbin down lightly with a finger.',
        'With your left hand, guide the thread through the slit and cut it with the cutter.',
        'Close the bobbin cover. You can start sewing. No need to pull the bobbin thread up.',
      ],
      tips: [
        'Use Brother SA156 (Class 15) bobbins. Other bobbins can cause tension problems even if they fit.',
        'Always cut the tail with the cutter. A loose tail can tangle and break the needle.',
      ],
      sources: [{ label: 'Brother support: installing the bobbin', url: BROTHER_FAQ + 'faqh00000580_006' }],
    },
    {
      key: 'needle',
      tab: 'Change the needle',
      title: 'Change the needle',
      steps: [
        'Press the needle position button to raise the needle, then **turn the machine off**.',
        "Lower the presser foot and put a scrap of paper under it so a dropped needle can't fall in.",
        'Loosen the needle clamp screw by turning it toward you (counterclockwise) with the disc screwdriver, and pull out the old needle.',
        'Slide in the new needle with the **flat side facing the back**. Push it up until it stops.',
        'Tighten the screw firmly.',
      ],
      tips: ['This machine uses standard home sewing needles (system 130/705H).', 'Start each new project with a fresh needle.'],
      sources: [{ label: 'Standard Brother procedure. Check your printed manual for pictures.' }],
    },
  ],
};

export const MACHINES: Machine[] = [POOLIN_EOC05, BROTHER_CS7000X];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function getMachine(id: string | null | undefined): Machine | undefined {
  return MACHINES.find((m) => m.id === id);
}

export interface MachineSearch {
  matches: Machine[];
  /** Set when the person typed only a brand we know, without a model. */
  brandOnly?: string;
}

/** Find machines from whatever the person typed, e.g. "poolin eoc 05". */
export function searchMachines(query: string): MachineSearch {
  const q = norm(query);
  if (q.length < 2) return { matches: [] };
  const matches = MACHINES.filter((m) => {
    const keys = [norm(m.model), norm(m.brand + m.model), ...(m.aliases ?? [])];
    return keys.some((k) => q.includes(k) || (q.length >= 3 && k.includes(q)));
  });
  if (matches.length) return { matches };
  const brand = MACHINES.find((m) => norm(m.brand) === q || norm(m.brand).startsWith(q));
  return { matches: [], brandOnly: brand?.brand };
}
