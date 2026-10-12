import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ItemCard {
  productID: number;
  productName: string;
  categoryName: string;
  unitPrice: number;
}

export interface LoginResponse {
  username: string;
  userID: string;
  role: string;
}

export interface CartItem {
  productID: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface OrderPayload {
  userID: string;
  orderDate: string;
  customerName: string;
  orderDetails: {
    productID: number;
    quantity: number;
  }[];
}
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Spark');
  private apiRoot = '/InterviewAPI';
  private http = inject(HttpClient);
  public cart = signal<CartItem[]>([]);

  public cartTotal = computed(() => {
    const items = this.cart();
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const discount = 0;
    let discountPercentage = 0;
    if (subtotal > 500) {
      discountPercentage = 0.10; 
    } else if (subtotal > 200) {
      discountPercentage = 0.03; 
    }
    const discountAmount = subtotal * discountPercentage;
    const taxableAmount = subtotal - discountAmount;

    return Number(taxableAmount.toFixed(2));
  });

  username = '';
  customername = '';
  password = '';
  loginStatus = '';

  userId = signal<string | null>(localStorage.getItem('user_id'));
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  private headers = new HttpHeaders({
    'Ocp-Apim-Subscription-Key': 'f252dddeba574e619df3ee4381780d7e',
    'Content-Type': 'application/json'
  });

  products$: Observable<ItemCard[]> = this.http.get<ItemCard[]>(
    this.apiRoot + "/Products",
    { headers: this.headers }
  );

  login(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiRoot}/Users/Authenticate`,
      { username: this.username, password: this.password },
      { headers: this.headers }
    );
  }

  onLoginSubmit() {
    if (!this.username || !this.password) return;

    this.errorMessage.set(null);

    this.login().subscribe({
      next: (response) => {
        const idStr = String(response.userID);

        this.userId.set(idStr);
        localStorage.setItem('user_id', idStr);
        this.successMessage.set('Login successful');

        console.log('Login successful: ', response.userID);
        this.successMessage.set('');
      },
      error: (err) => {
        if (err.status === 401) {
          this.errorMessage.set(err.error?.error || 'Invalid credentials');
        } else {
          this.errorMessage.set('An unexpected error occurred.');
        }
        console.error('Login failed:', err);
      }
    });
  }

  submitOrder() {
    if (!this.customername) { this.errorMessage.set("Customer Name Required !"); return; }
    this.errorMessage.set("");
    const items = this.cart();
    if (items.length === 0) return;

    const totalValue = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    const orderPayload: OrderPayload = {
      userID: this.userId()!,
      orderDate: new Date().toISOString(),
      customerName: this.customername,
      orderDetails: items.map(item => ({
        productID: Number(item.productID),
        quantity: Number(item.quantity)
      }))
    };

    this.http.post(`${this.apiRoot}/Orders`, JSON.stringify(orderPayload, null, 2), { headers: this.headers })
      .subscribe({
        next: (response) => {
          this.errorMessage.set('');
          this.successMessage.set('Order submitted successfully');
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error || 'Invalid credentials');
          console.error('Failed to submit order:', err);
        }
      });
  }

  addToCart(product: { productID: number; productName: string; unitPrice: number }) {
    this.cart.update(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.productID === product.productID);

      if (existingIndex > -1) {
        const updated = [...currentItems];
        const currentItem = updated[existingIndex];

        const newQuantity = currentItem.quantity + 1;
        updated[existingIndex] = {
          ...currentItem,
          quantity: newQuantity,
          total: Number((currentItem.unitPrice * newQuantity).toFixed(2))
        };

        return updated;
      }

      return [
        ...currentItems,
        {
          ...product,
          quantity: 1,
          total: Number((product.unitPrice * 1).toFixed(2))
        }
      ];
    });
    console.log('Current Cart:', this.cart());
  }

  removeFromCart(productID: number) {
    this.cart.update(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.productID === productID);

      if (existingIndex > -1) {
        const updated = [...currentItems];
        const currentItem = updated[existingIndex];

        if (currentItem.quantity > 1) {
          const newQuantity = currentItem.quantity - 1;
          updated[existingIndex] = {
            ...currentItem,
            quantity: newQuantity,
            total: Number((currentItem.unitPrice * newQuantity).toFixed(2))
          };
          return updated;
        } else {
          return currentItems.filter(i => i.productID !== productID);
        }
      }
      return currentItems;
    });
  }
  logout() {
    localStorage.removeItem('user_id');
    localStorage.clear();
    this.userId.set(null);
    console.log('Logged out, userId is now:', this.userId());
  }
}