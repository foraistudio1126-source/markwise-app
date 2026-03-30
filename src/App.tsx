import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useDecks, useCards } from './hooks/useStore'
import HomePage from './pages/HomePage'
import DeckDetailPage from './pages/DeckDetailPage'
import CardEditPage from './pages/CardEditPage'
import ImportPage from './pages/ImportPage'
import StudyPage from './pages/StudyPage'
import AnalyticsPage from './pages/AnalyticsPage'
import DeckSettingsPage from './pages/DeckSettingsPage'
import './App.css'

export default function App() {
  const { decks, addDeck, updateDeck, deleteDeck } = useDecks()
  const { cards, addCard, addCards, updateCard, deleteCard } = useCards()

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                decks={decks}
                cards={cards}
                onAddDeck={addDeck}
                onDeleteDeck={deleteDeck}
                onUpdateDeck={updateDeck}
              />
            }
          />
          <Route
            path="/deck/:deckId"
            element={
              <DeckDetailPage
                decks={decks}
                cards={cards}
                onDeleteCard={deleteCard}
              />
            }
          />
          <Route
            path="/deck/:deckId/add"
            element={
              <CardEditPage
                decks={decks}
                cards={cards}
                onAddCard={addCard}
                onUpdateCard={updateCard}
              />
            }
          />
          <Route
            path="/deck/:deckId/edit/:cardId"
            element={
              <CardEditPage
                decks={decks}
                cards={cards}
                onAddCard={addCard}
                onUpdateCard={updateCard}
              />
            }
          />
          <Route
            path="/deck/:deckId/import"
            element={
              <ImportPage
                decks={decks}
                onAddCards={addCards}
                onUpdateDeck={updateDeck}
              />
            }
          />
          <Route
            path="/study/:deckId"
            element={
              <StudyPage
                decks={decks}
                cards={cards}
              />
            }
          />
          <Route
            path="/deck/:deckId/analytics"
            element={
              <AnalyticsPage
                decks={decks}
                cards={cards}
              />
            }
          />
          <Route
            path="/deck/:deckId/settings"
            element={
              <DeckSettingsPage
                decks={decks}
                cards={cards}
                onAddDeck={addDeck}
                onAddCards={addCards}
                onUpdateCard={updateCard}
                onUpdateDeck={updateDeck}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
