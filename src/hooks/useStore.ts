import { useState, useCallback } from 'react'
import type { Deck, Card } from '../types'
import { loadDecks, saveDecks, loadCards, saveCards } from '../utils/storage'

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks())

  const addDeck = useCallback((deck: Deck) => {
    setDecks(prev => {
      const next = [...prev, deck]
      saveDecks(next)
      return next
    })
  }, [])

  const updateDeck = useCallback((id: string, updates: Partial<Deck>) => {
    setDecks(prev => {
      const next = prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d)
      saveDecks(next)
      return next
    })
  }, [])

  const deleteDeck = useCallback((id: string) => {
    setDecks(prev => {
      const next = prev.filter(d => d.id !== id)
      saveDecks(next)
      return next
    })
  }, [])

  const refreshDecks = useCallback(() => {
    setDecks(loadDecks())
  }, [])

  return { decks, addDeck, updateDeck, deleteDeck, refreshDecks }
}

export function useCards() {
  const [cards, setCards] = useState<Card[]>(() => loadCards())

  const addCard = useCallback((card: Card) => {
    setCards(prev => {
      const next = [...prev, card]
      saveCards(next)
      return next
    })
  }, [])

  const addCards = useCallback((newCards: Card[]) => {
    setCards(prev => {
      const next = [...prev, ...newCards]
      saveCards(next)
      return next
    })
  }, [])

  const updateCard = useCallback((id: string, updates: Partial<Card>) => {
    setCards(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)
      saveCards(next)
      return next
    })
  }, [])

  const deleteCard = useCallback((id: string) => {
    setCards(prev => {
      const next = prev.filter(c => c.id !== id)
      saveCards(next)
      return next
    })
  }, [])

  const getCardsForDeck = useCallback((deckId: string) => {
    return cards.filter(c => c.deckId === deckId)
  }, [cards])

  const refreshCards = useCallback(() => {
    setCards(loadCards())
  }, [])

  return { cards, addCard, addCards, updateCard, deleteCard, getCardsForDeck, refreshCards }
}
