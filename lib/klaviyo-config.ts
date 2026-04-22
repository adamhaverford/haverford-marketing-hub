export const KLAVIYO_BRAND_CONFIG: Record<string, {
  account: string
  metrics: {
    opened: string
    clicked: string
    received: string
    spam: string
    bounced: string
    unsubscribed: string
    subscribed: string
    placedOrder: string
  }
}> = {
  'catnets-au': {
    account: 'catnets-au',
    metrics: {
      opened:       'SZNtNH',
      clicked:      'XQGk4V',
      received:     'UNemjc',
      spam:         'UtHjVC',
      bounced:      'Wg9ds7',
      unsubscribed: 'Ry54TL',
      subscribed:   'Vmx5mE',
      placedOrder:  'VvSEhd',
    },
  },
  'haverford': {
    account: 'haverford',
    metrics: {
      opened:       'Yytp2q',
      clicked:      'VACEC5',
      received:     'SyaFSk',
      spam:         'SQEH7p',
      bounced:      'UD6ABS',
      unsubscribed: 'RQa5sF',
      subscribed:   'W8H8Ts',
      placedOrder:  'XtFNtW',
    },
  },
  'justprotools-au': {
    account: 'justprotools-au',
    metrics: {
      opened:       'SP5aYY',
      clicked:      'UBv4vt',
      received:     'R2Dhuv',
      spam:         'YckPwr',
      bounced:      'Sc48nm',
      unsubscribed: 'W3KmuX',
      subscribed:   'UYqkZz',
      placedOrder:  'TSBQyJ',
    },
  },
  'gutzbusta-au': {
    account: 'gutzbusta-au',
    metrics: {
      opened:       'Sbhaei',
      clicked:      'QZSjks',
      received:     'VL8Vfg',
      spam:         'W4CWuj',
      bounced:      'XR4PYN',
      unsubscribed: 'SAup9f',
      subscribed:   'RpWMuU',
      placedOrder:  'WtMedh',
    },
  },
}
