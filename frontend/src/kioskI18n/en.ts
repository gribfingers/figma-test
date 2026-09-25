/** English dictionary for the kiosk, keyed by the Russian source text (see ../kioskI18n.tsx). */
export const KIOSK_EN: Record<string, string> = {
  // Prohibited items
  "Оружие, боеприпасы и их имитации": "Weapons, ammunition and replicas",
  "Легковоспламеняющиеся и взрывчатые вещества": "Flammable and explosive substances",
  "Едкие и отравляющие химические вещества": "Corrosive and toxic chemicals",
  "Сжатые и сжиженные газы (баллоны)": "Compressed and liquefied gases (cylinders)",
  "Жидкости в ручной клади свыше 100 мл": "Liquids in carry-on over 100 ml",

  // Welcome / rules
  "Добро пожаловать в киоск регистрации пассажиров на рейс": "Welcome to the passenger self-check-in kiosk",
  "Продолжить": "Continue",
  "Что запрещено к провозу": "Prohibited items",
  "Начать регистрацию": "Start check-in",
  "Назад": "Back",

  // Lookup
  "Найдите вашу бронь": "Find your booking",
  "Введите код бронирования и фамилию любого пассажира — если летите группой, зарегистрируем всех сразу":
    "Enter the booking code and any passenger's surname — travelling as a group? We'll check everyone in at once",
  "Код бронирования (PNR)": "Booking code (PNR)",
  "Например, ABC123": "e.g. ABC123",
  "Фамилия": "Surname",
  "Ищем…": "Searching…",
  "Найти бронь": "Find booking",

  // Found
  "На рейс {flight} уже зарегистрированы все пассажиры этой брони": "All passengers on this booking are already checked in for flight {flight}",
  "Место {seat}": "Seat {seat}",
  "Сдать багаж": "Drop baggage",
  "Ваш рейс {flight}": "Your flight {flight}",
  "Уже зарегистрирован(а) · место {seat}": "Already checked in · seat {seat}",
  "Теперь вы можете перейти к выбору мест в салоне самолёта": "You can now choose seats in the cabin",
  "Перейти к выбору мест": "Choose seats",

  // Seats
  "Выбор места": "Select seats",
  "Выберите места в салоне самолёта. После этого вы сможете зарегистрироваться на рейс, а затем — оформить багаж":
    "Choose your seats in the cabin. Then you'll be able to check in for the flight, and after that — register your baggage",
  "Регистрируем…": "Checking in…",
  "Зарегистрировать": "Check in",
  "Шаг {n} из 3": "Step {n} of 3",

  // Confirm
  "На рейс {flight} зарегистрированы:": "Checked in for flight {flight}:",
  "Не удалось зарегистрировать: {list}": "Could not check in: {list}",
  "Перейти к регистрации багажа": "Continue to baggage",

  // Baggage (check-in)
  "Регистрация багажа": "Register baggage",
  "Поставьте одно место вашего багажа на платформу слева от дисплея": "Place one piece of your baggage on the scale to the left of the screen",
  "{w} кг": "{w} kg",
  "Удалить": "Remove",
  "Добавить место багажа": "Add a bag",
  "Печатаем…": "Printing…",
  "Распечатать багажные бирки": "Print baggage tags",
  "Без багажа — завершить": "No baggage — finish",
  "Без багажа — далее": "No baggage — next",

  // Success
  "Счастливого полёта!": "Have a great flight!",
  "Багажные бирки:": "Baggage tags:",
  "Теперь вам следует отнести багаж на ленту транспортёра": "Please take your baggage to the conveyor belt",
  "Багажа нет — проходите к выходу на посадку по указателям.": "No baggage — please proceed to your boarding gate.",
  "Закончить сеанс регистрации": "Finish check-in session",

  // Frame chrome
  "Терминал C": "Terminal C",
  "Рейс {flight}": "Flight {flight}",

  // Bag drop
  "Сдача багажа": "Baggage drop",
  "Отсканируйте бирку багажа": "Scan your baggage tag",
  "Номер бирки": "Tag number",
  "Найти по бирке": "Find by tag",
  "или, если бирки под рукой нет —": "or, if you don't have the tag handy —",
  "Найти по брони": "Find by booking",
  "Багаж уже сдан": "Baggage already dropped off",
  "Все пассажиры этой брони": "All passengers on this booking",
  "{who}, рейс {flight} — все места багажа уже приняты.": "{who}, flight {flight} — all baggage has already been accepted.",
  "Начать заново": "Start over",
  "Разместите багаж на ленте": "Place your baggage on the belt",
  "Мест багажа: {n}": "Bags: {n}",
  "Всего мест багажа: {n}": "Total bags: {n}",
  "Багаж размещён на весах": "Baggage placed on the scale",
  "Взвешивание и сверка данных…": "Weighing and verifying data…",
  "Не убирайте багаж с ленты": "Don't remove your baggage from the belt",
  "Поздравляем! Весь багаж сдан!": "Congratulations! All baggage dropped off!",
  "Поздравляем! Ваш багаж сдан!": "Congratulations! Your baggage has been dropped off!",
  "№ {n}": "No. {n}",
  "стойка отправки багажа": "baggage drop desk",
  "Проходите на посадку по указателям к вашему выходу.": "Please proceed to your boarding gate.",
  "Сдать багаж другой брони": "Drop baggage for another booking",
  "Шаг {n} из 2": "Step {n} of 2",
};
